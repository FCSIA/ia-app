import csv

def read_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))

x = read_csv("students_alpha.csv")
y = read_csv("students_it.csv")
z = read_csv("students_hc.csv")

exclude_ids = {row["student_id"] for row in y} | {
    row["student_id"] for row in z
}

result = [
    {
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "student_id": row["student_id"],
    }
    for row in x
    if row["student_id"] not in exclude_ids
]

with open("students_eng.csv", "w", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=["first_name", "last_name", "student_id"]
    )
    writer.writeheader()
    writer.writerows(result)

print(f"{len(result)} students written")
