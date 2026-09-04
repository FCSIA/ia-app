import csv

with open('students_it.csv', mode='r') as file:
    it_students = list(csv.DictReader(file))
    for row in it_students:
        row.pop("email", None)
        row.pop("temporary_password", None)

with open('students_alpha.csv', mode='r') as file:
    all_students = list(csv.DictReader(file))

match_keys = list(it_students[0].keys())

def d(student_list, keys):
    return {tuple(row[k] for k in keys) for row in student_list}

it_set = d(it_students, match_keys)
all_set = d(all_students, match_keys)
overlap_tuples = it_set & all_set

overlap_dicts = [dict(zip(match_keys, row)) for row in overlap_tuples]

print(len(overlap_tuples))
print(len(it_set))
print(it_set - overlap_tuples)

# print(overlap_dicts)
