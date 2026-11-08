import os, re

pattern = re.compile(r'backgroundColor:\s*[\'"]#(?:fff|ffffff)[\'"]|borderColor:\s*[\'"]#(?:fff|ffffff)[\'"]', re.IGNORECASE)

results = []
for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                for i, line in enumerate(lines):
                    if pattern.search(line):
                        results.append(f'{path}:{i+1}: {line.strip()}')

print(f'Total hardcoded white backgrounds/borders: {len(results)}')
for r in results:
    print(r)
