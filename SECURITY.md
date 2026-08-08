# Security policy

## Reporting a vulnerability

Do not open a public issue with exploit details, real account information, or
school data.

Contact the IA App maintainers through an existing school-approved private
channel. Include only the minimum reproduction details and use synthetic test
accounts whenever possible. If you do not have a private channel, open a public
issue titled `Security contact requested` with no technical details so a
maintainer can arrange one.

Do not test a suspected vulnerability against production, a shared Convex
deployment, another person's account, or real student data. Do not download,
retain, or redistribute data encountered by accident.

## Maintainer response

Maintainers should:

1. acknowledge the report privately;
2. reproduce it with synthetic data in an isolated local deployment;
3. limit issue and pull-request visibility while a fix is developed;
4. add a regression test, including a denied-access case for authorization
   bugs;
5. coordinate any disclosure, credential rotation, data notice, or district
   escalation with the authorized school owner.

Production access, legal notification, and district incident response are
outside a student contributor's authority.
