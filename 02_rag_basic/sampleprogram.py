def analyze_two_numbers(a, b):
    sum= a+b
    difference = a - b
    product = a * b 

    results = {"sum": f"{a} and {b} give {sum}",
               "difference": f"{a} minus {b} gives {difference}",
               "product": f"{a} times {b} gives {product}"}
   
    return results
        
output = analyze_two_numbers(10, 5)
print(output)    
    

