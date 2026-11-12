import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/src/_generated/api";
import { normalizeCsvHeader, readCsv, writeCsv } from "../../../shared/csv";
import { APP_ROLES, type AppRole } from "../../../shared/roles";
import { PATHWAY_LABELS, isPathway } from "../../../shared/labels";
import { hostArgv } from "../client/host";
import { asId } from "../client/ids";
import { action, connect, mutation, query, refine, type Connection } from "../client/session";
import { confirmDestructive } from "../core/consent";
import { CliError, usageError } from "../core/errors";
import { sanitizeRemoteText } from "../core/theme";
import type { CommandContext, CommandSpec, GroupSpec } from "../registry/types";
import { limitOption } from "./announcements";
import { personName } from "./format";
import { appendOption, readFileOrStdin } from "./input";
import { pathwayInput } from "./pathways";

type AdminUser = FunctionReturnType<typeof api.users.admin.list>["page"][number];

const GROUPS = ["students", "teachers", "student-admin", "other", "all"] as const;
type UserGroup = (typeof GROUPS)[number];

function userDocument(user: AdminUser) {
  return {
    id: user._id,
    uniqueId: user.uniqueId,
    name: personName(user),
    firstName: sanitizeRemoteText(user.firstName),
    lastName: sanitizeRemoteText(user.lastName),
    preferredName: user.preferredName ? sanitizeRemoteText(user.preferredName) : null,
    roles: user.roles,
    gradeLevel: user.gradeLevel ?? null,
    major: user.major ? (isPathway(user.major) ? PATHWAY_LABELS[user.major] : user.major) : null,
    minor: user.minor ? (isPathway(user.minor) ? PATHWAY_LABELS[user.minor] : user.minor) : null,
    email: user.email ?? null,
    isActive: user.isActive,
    isDeveloper: user.isDeveloper,
  };
}

function listUsers(
  connection: Connection,
  options: { limit?: number; search?: string; group?: UserGroup; userId?: string },
) {
  return query(connection, api.users.admin.list, {
    paginationOpts: { numItems: options.limit ?? 25, cursor: null },
    ...(options.search ? { search: options.search } : {}),
    ...(options.group && options.group !== "all" ? { roleGroup: options.group } : {}),
    ...(options.userId ? { userId: options.userId } : {}),
  });
}

function missingUser(ref: string, connection: Connection) {
  return new CliError("not_found", "user_not_found", `No person you can see has ID ${ref}.`, {
    next: [
      {
        benefit: "Find them",
        argv: ["users", "list", "--search", ref, ...hostArgv(connection.host, connection.hostSource)],
      },
    ],
  });
}

// People type a student ID far more readily than an internal ID, so both work.
async function findUser(connection: Connection, ref: string) {
  const exact = await listUsers(connection, { limit: 1, userId: ref });
  const byId = exact.page.find((user) => user._id === ref);
  if (byId) return byId;
  const searched = await listUsers(connection, { limit: 25, search: ref });
  return searched.page.find((user) => user.uniqueId.toLowerCase() === ref.toLowerCase()) ?? null;
}

function userError(error: unknown, connection: Connection): never {
  const list = [
    {
      benefit: "See people",
      argv: ["users", "list", ...hostArgv(connection.host, connection.hostSource)],
    },
  ];
  refine(error, [
    {
      match: /User not found/,
      kind: "not_found",
      reason: "user_not_found",
      message: "That person no longer exists.",
      next: list,
    },
    {
      match: /One or more selected users no longer exist/,
      kind: "not_found",
      reason: "user_not_found",
      message: "Someone in that list no longer exists. Refresh the list and pick again.",
      next: list,
    },
    {
      match: /cannot (deactivate|delete) your own account/i,
      kind: "permission",
      reason: "cannot_act_on_self",
      message: "You can't do that to your own account.",
    },
    {
      match: /equal or greater privileges/,
      kind: "permission",
      reason: "insufficient_privilege",
      message: "You can only act on accounts below your own role.",
    },
    {
      match: /Only super admins/,
      kind: "permission",
      reason: "super_admin_required",
      message: "Only a super admin can change admin accounts.",
    },
    {
      match: /Support staff can only reset student passwords/,
      kind: "permission",
      reason: "students_only",
      message: "Support staff can only reset student passwords.",
    },
    {
      match: /not linked to an auth account/,
      kind: "conflict",
      reason: "no_auth_account",
      message: "That person has no sign-in account, so there's nothing to change.",
    },
    {
      match: /at least one role/,
      kind: "usage",
      reason: "roles_required",
      message: "An account needs at least one role.",
    },
    {
      match: /students can have the Student Admin role/,
      kind: "limit",
      reason: "student_admin_limit",
      message: "The school already has the maximum number of student admins.",
    },
    {
      match: /Delete at most/,
      kind: "limit",
      reason: "too_many_users",
      message: "Delete fewer people at a time.",
    },
    {
      match: /Auth maintenance is not configured/,
      kind: "platform",
      reason: "maintenance_unavailable",
      message: "Account deletion needs auth maintenance, which this site hasn't configured.",
    },
  ]);
}

async function requireUser(connection: Connection, ref: string) {
  const user = await findUser(connection, ref);
  if (!user) throw missingUser(ref, connection);
  return user;
}

const list: CommandSpec = {
  kind: "command",
  name: "list",
  summary: "List people in the school directory",
  json: true,
  aliases: ["ls"],
  options: [
    { name: "search", type: "string", valueHint: "TEXT", description: "Match names, IDs, or email" },
    {
      name: "group",
      type: "string",
      valueHint: "GROUP",
      description: `One of ${GROUPS.join(", ")}`,
    },
    { name: "limit", type: "string", valueHint: "N", description: "How many to show (default: 25)" },
  ],
  examples: [
    { description: "Find a person", argv: ["users", "list", "--search", "ada"] },
    { description: "See the newest students", argv: ["users", "list", "--group", "students"] },
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const group = context.options.group === undefined ? "all" : String(context.options.group);
    if (!(GROUPS as readonly string[]).includes(group)) {
      throw usageError("invalid_group", `${group} isn't a group. Use ${GROUPS.join(", ")}.`);
    }
    const search = typeof context.options.search === "string" ? context.options.search : undefined;
    const page = await listUsers(connection, {
      limit: limitOption(context, 25),
      search,
      group: group as UserGroup,
    });
    const users = page.page.map(userDocument);

    if (out.json) {
      out.document({ users, isDone: page.isDone, continueCursor: page.continueCursor || undefined });
      return;
    }
    if (users.length === 0) {
      out.text(search ? `Nobody matches "${search}".` : "Nobody in that group.");
      return;
    }
    out.table(
      ["ID", "Name", "Roles", "Grade", "Status"],
      users.map((user) => [
        user.uniqueId,
        user.name ?? "",
        user.roles.join(", "),
        user.gradeLevel === null ? "" : String(user.gradeLevel),
        user.isActive ? "Active" : "Inactive",
      ]),
    );
    out.text(page.isDone ? `${users.length} shown.` : `${users.length} shown; more match. Narrow with --search.`);
  },
};

const inspect: CommandSpec = {
  kind: "command",
  name: "inspect",
  summary: "Show one person",
  json: true,
  arguments: [{ name: "user", required: true, description: "Student ID or internal user ID" }],
  examples: [{ description: "Show a person", argv: ["users", "inspect", "STU001"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const user = await requireUser(connection, context.args[0]!);
    const document = userDocument(user);

    if (out.json) {
      out.document({ user: document });
      return;
    }
    out.detail([
      ["Name", document.name ?? ""],
      ["Student ID", document.uniqueId],
      ["Roles", document.roles.join(", ")],
      ["Grade", document.gradeLevel === null ? "" : String(document.gradeLevel)],
      ["Major", document.major ?? ""],
      ["Minor", document.minor ?? ""],
      ["Email", document.email ?? ""],
      ["Status", document.isActive ? "Active" : "Inactive"],
      ["User ID", document.id],
    ]);
  },
};

const activate: CommandSpec = {
  kind: "command",
  name: "activate",
  summary: "Let a deactivated person sign in again",
  json: true,
  arguments: [{ name: "user", required: true, description: "Student ID or internal user ID" }],
  examples: [{ description: "Reactivate an account", argv: ["users", "activate", "STU001"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const user = await requireUser(connection, context.args[0]!);
    let updated;
    try {
      updated = await mutation(connection, api.users.admin.activate, { userId: user._id });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "activated", user: userDocument(updated) });
      return;
    }
    out.success("Activated", personName(updated) ?? updated.uniqueId);
  },
};

const deactivate: CommandSpec = {
  kind: "command",
  name: "deactivate",
  summary: "Sign a person out and block new sign-ins",
  json: true,
  arguments: [{ name: "user", required: true, description: "Student ID or internal user ID" }],
  examples: [{ description: "Deactivate an account", argv: ["users", "deactivate", "STU001"] }],
  notes: ["Signs them out everywhere and blocks new sign-ins until someone activates the account."],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const user = await requireUser(connection, context.args[0]!);
    await confirmDestructive(context, {
      summary: `Deactivate ${personName(user) ?? user.uniqueId}`,
      consequence: "This signs them out everywhere and blocks new sign-ins.",
    });
    let updated;
    try {
      updated = await mutation(connection, api.users.admin.deactivate, { userId: user._id });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "deactivated", user: userDocument(updated) });
      return;
    }
    out.success("Deactivated", personName(updated) ?? updated.uniqueId);
  },
};

const remove: CommandSpec = {
  kind: "command",
  name: "delete",
  summary: "Permanently delete accounts",
  json: true,
  aliases: ["rm"],
  arguments: [
    { name: "users", required: true, variadic: true, description: "Student IDs or internal user IDs" },
  ],
  examples: [{ description: "Delete accounts", argv: ["users", "delete", "STU001", "STU002"] }],
  notes: ["Deletes their sign-in, profile, and files. This can't be undone."],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const refs = context.args;
    const users = await Promise.all(refs.map((ref) => requireUser(connection, ref)));
    await confirmDestructive(context, {
      summary: `Permanently delete ${users.length === 1 ? (personName(users[0]!) ?? users[0]!.uniqueId) : `${users.length} accounts`}`,
      consequence: "This deletes their sign-in, profile, and files. It can't be undone.",
    });
    let result;
    try {
      result = await mutation(connection, api.users.admin.deleteUsers, {
        userIds: users.map((user) => user._id),
      });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "deleted", deleted: result.deleted, users: users.map(userDocument) });
      return;
    }
    out.success("Deleted", `${result.deleted} ${result.deleted === 1 ? "account" : "accounts"}`);
  },
};

const exportStudents: CommandSpec = {
  kind: "command",
  name: "export",
  summary: "Print the student roster as CSV",
  json: true,
  examples: [{ description: "Save the roster as CSV", argv: ["users", "export"] }],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const students = await query(connection, api.users.admin.exportStudents, {});

    if (out.json) {
      out.document({ students });
      return;
    }
    out.print(
      writeCsv(
        ["student_id", "first_name", "last_name", "email", "grade_level", "major", "minor"],
        students.map((student) => [
          student.uniqueId,
          student.firstName,
          student.lastName,
          student.email,
          student.gradeLevel,
          student.major ? (isPathway(student.major) ? PATHWAY_LABELS[student.major] : student.major) : null,
          student.minor ? (isPathway(student.minor) ? PATHWAY_LABELS[student.minor] : student.minor) : null,
        ]),
      ),
    );
  },
};

const IMPORT_COLUMNS = ["student_id", "first_name", "last_name", "email", "grade_level", "major", "minor"] as const;

function parseImportCsv(text: string) {
  let records: ReturnType<typeof readCsv>;
  try {
    records = readCsv(text);
  } catch (error) {
    throw usageError("invalid_csv", error instanceof Error ? error.message : "Can't read that CSV.");
  }
  const [header, ...rows] = records;
  if (!header) throw usageError("invalid_csv", "The CSV has no header row.");
  const columns = header.cells.map(normalizeCsvHeader);
  const at = (name: string) => columns.indexOf(normalizeCsvHeader(name));
  const required = ["student_id", "first_name", "last_name"].filter((name) => at(name) === -1);
  if (required.length > 0) {
    throw usageError(
      "invalid_csv",
      `The CSV needs ${required.join(", ")}. Export the roster and edit that file to keep the columns.`,
      { data: { expected: IMPORT_COLUMNS } },
    );
  }
  if (rows.length === 0) throw usageError("invalid_csv", "The CSV has no data rows.");
  if (rows.length > 200) {
    throw usageError("invalid_csv", "Import at most 200 people at a time. Split this CSV.");
  }

  const seen = new Set<string>();
  return rows.map(({ line, cells }) => {
    const cell = (name: string) => {
      const index = at(name);
      return index === -1 ? "" : (cells[index] ?? "").trim();
    };
    const uniqueId = cell("student_id");
    const firstName = cell("first_name");
    const lastName = cell("last_name");
    if (!uniqueId) throw usageError("invalid_csv", `Line ${line}: student_id is empty.`);
    if (seen.has(uniqueId.toUpperCase())) {
      throw usageError("invalid_csv", `Line ${line}: ${uniqueId} appears twice in this file.`);
    }
    seen.add(uniqueId.toUpperCase());
    if (!firstName || !lastName) {
      throw usageError("invalid_csv", `Line ${line}: first_name and last_name are required.`);
    }
    const grade = cell("grade_level");
    const gradeLevel = grade === "" ? undefined : Number(grade);
    if (gradeLevel !== undefined && (!/^\d+$/.test(grade) || gradeLevel < 9 || gradeLevel > 12)) {
      throw usageError("invalid_csv", `Line ${line}: grade_level must be 9 through 12.`);
    }
    return {
      uniqueId,
      firstName,
      lastName,
      ...(cell("email") ? { email: cell("email") } : {}),
      ...(gradeLevel === undefined ? {} : { gradeLevel }),
      ...(cell("major") ? { major: pathwayInput(cell("major"), `Line ${line}: major`) } : {}),
      ...(cell("minor") ? { minor: pathwayInput(cell("minor"), `Line ${line}: minor`) } : {}),
    };
  });
}

const importStudents: CommandSpec = {
  kind: "command",
  name: "import",
  summary: "Create student accounts from CSV",
  json: true,
  arguments: [{ name: "file", required: true, description: "CSV file, or - for standard input" }],
  options: [{ name: "dry-run", type: "boolean", description: "Check the file without creating anyone" }],
  examples: [
    { description: "Check a roster first", argv: ["users", "import", "students.csv", "--dry-run"] },
    { description: "Create the accounts", argv: ["users", "import", "students.csv"] },
  ],
  notes: [
    "Uses the columns from users export: student_id, first_name, last_name, and optional email, grade_level, major, minor.",
    "New students get a temporary password, printed once in the result.",
  ],
  async run(context) {
    const { out } = context;
    const path = context.args[0]!;
    const text = await readFileOrStdin(context, path);
    const rows = parseImportCsv(text);

    if (context.options["dry-run"] === true) {
      if (out.json) {
        out.document({ outcome: "checked", rows: rows.length, students: rows });
        return;
      }
      out.success("Checked", `${rows.length} ${rows.length === 1 ? "student" : "students"}`);
      out.text("Nothing was created. Run it again without --dry-run to import them.");
      return;
    }

    await confirmDestructive(context, {
      summary: `Create ${rows.length} ${rows.length === 1 ? "student account" : "student accounts"}`,
      consequence: "Each new student can sign in, and their temporary password can't be shown again later.",
    });
    const connection = await connect(context);
    let result;
    try {
      result = await action(connection, api.users.admin.importStudents, { rows });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({
        outcome: "imported",
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
        generatedCredentials: result.generatedCredentials,
      });
      return;
    }
    out.success("Imported", `${result.created} created, ${result.skipped} skipped`);
    for (const error of result.errors) out.text(error);
    if (result.generatedCredentials.length > 0) {
      out.blank();
      out.text("Temporary passwords, shown once:");
      out.table(
        ["ID", "Name", "Email", "Temporary password"],
        result.generatedCredentials.map((credential) => [
          credential.uniqueId,
          `${credential.firstName} ${credential.lastName}`,
          credential.email,
          credential.temporaryPassword,
        ]),
      );
      out.text("Share each password with its student through a channel you trust. They must change it.");
    }
  },
};

const ROLE_NAMES = APP_ROLES.map((role) => role.toLowerCase());

const setRoles: CommandSpec = {
  kind: "command",
  name: "set",
  summary: "Replace a person's roles",
  json: true,
  arguments: [{ name: "user", required: true, description: "Student ID or internal user ID" }],
  options: [
    {
      name: "role",
      type: "string",
      valueHint: "ROLE",
      description: `Repeat for each role: ${ROLE_NAMES.join(", ")}`,
      repeat: "append",
    },
  ],
  examples: [
    { description: "Make a student a club sponsor", argv: ["users", "roles", "set", "STU001", "--role", "SPONSOR"] },
  ],
  notes: ["Replaces the whole role list. Pass every role the person should keep."],
  async run(context) {
    const { out } = context;
    const roles = appendOption(context, "role").map((role) => role.trim().replace(/-/g, "_").toUpperCase());
    if (roles.length === 0) {
      throw usageError("roles_required", "Pass at least one --role.", {
        next: [{ benefit: "See the roles", argv: ["users", "roles", "set", "--help"] }],
      });
    }
    const unknown = roles.filter((role) => !(APP_ROLES as readonly string[]).includes(role));
    if (unknown.length > 0) {
      throw usageError("invalid_role", `${unknown.join(", ")} isn't a role. Use ${ROLE_NAMES.join(", ")}.`);
    }
    const connection = await connect(context);
    const user = await requireUser(connection, context.args[0]!);
    await confirmDestructive(context, {
      summary: `Change ${personName(user) ?? user.uniqueId}'s roles to ${roles.join(", ")}`,
      consequence: "The new roles take effect immediately; the old ones stop working.",
    });
    let updated;
    try {
      updated = await mutation(connection, api.users.admin.assignRoles, {
        userId: user._id,
        roles: roles as AppRole[],
      });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({ outcome: "roles_changed", user: userDocument(updated) });
      return;
    }
    out.success("Set roles", personName(updated) ?? updated.uniqueId);
    out.row("Roles", updated.roles.join(", "));
  },
};

const resetPassword: CommandSpec = {
  kind: "command",
  name: "reset",
  summary: "Give a person a temporary password",
  json: true,
  arguments: [{ name: "user", required: true, description: "Student ID or internal user ID" }],
  examples: [{ description: "Reset a password", argv: ["users", "passwords", "reset", "STU001"] }],
  notes: [
    "Signs them out everywhere and prints a temporary password once. They must change it at next sign-in.",
  ],
  async run(context) {
    const { out } = context;
    const connection = await connect(context);
    const user = await requireUser(connection, context.args[0]!);
    await confirmDestructive(context, {
      summary: `Reset ${personName(user) ?? user.uniqueId}'s password`,
      consequence: "This signs them out everywhere and replaces their password.",
    });
    let result;
    try {
      result = await mutation(connection, api.users.admin.resetPassword, { userId: user._id });
    } catch (error) {
      userError(error, connection);
    }

    if (out.json) {
      out.document({
        outcome: "password_reset",
        user: userDocument(user),
        temporaryPassword: result.temporaryPassword,
      });
      return;
    }
    out.print(result.temporaryPassword);
    out.blank();
    out.row("Temporary password for", personName(user) ?? user.uniqueId);
    out.text("Share it through a channel you trust. They must change it at next sign-in.");
  },
};

const rolesGroup: GroupSpec = {
  kind: "group",
  name: "roles",
  summary: "Change what a person can do",
  children: [setRoles],
};

const passwordsGroup: GroupSpec = {
  kind: "group",
  name: "passwords",
  summary: "Reset someone's password",
  children: [resetPassword],
};

export const usersGroup: GroupSpec = {
  kind: "group",
  name: "users",
  summary: "Find people, manage accounts, and move rosters",
  section: "Staff",
  children: [list, inspect, activate, deactivate, remove, exportStudents, importStudents, rolesGroup, passwordsGroup],
};
