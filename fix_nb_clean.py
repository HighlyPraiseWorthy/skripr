"""fix_nb_clean.py — clean final fix for niche-bend/page.tsx"""
import os, sys

p = "/Users/antondavids/workspace/skripr/src/app/dashboard/niche-bend/page.tsx"
lines = open(p).read().splitlines()
n0 = len(lines)
print(f"Start: {n0} lines")

VM_TAG   = "/* \u2500\u2500 Viral Magnet (shared) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */"
VM2_TAG  = "/* \u2500\u2500\u2500 Viral Magnet Picker \u2500\u2500\u2500 */"
H3       = "Bend Potential Score"

def show(s, e, lbl):
    print(f"\n--- {lbl}")
    for i in range(s, min(e, len(lines))):
        ind = len(lines[i]) - len(lines[i].lstrip())
        print(f"  L{i+1} ind={ind:2} | {lines[i][:85]}")

ASSERT = "\"))) assert ("  # won't appear in file content; used as separator

# STEP 1: L441 HTML → JSX comment
assert "<!-- " in lines[440] and "Score card" in lines[440]
lines[440] = "            {/* " + "Score card" + " */}"
print("Step 1: L441 done.")

# STEP 2a: stray )} at L479 after duplicate was validated
assert lines[477].strip() == "</div>" and lines[478].strip() == ")"
show(477, 491, "Before stray+dup deletion")
lines.pop(478)
print("Step 2a: stray line gone.")

# STEP 2b: delete duplicate score card
assert H3 in lines[478]
dup_end = None
for i in range(478, len(lines)):
    if lines[i].strip() == ")" and lines[i].startswith("            )"):
        dup_end = i; break
assert dup_end
print(f"Deleting dup L479-{dup_end+1}")
del lines[478:dup_end+1]
show(476, 496, "After dup deletion")

# STEP 3: dedent VM(shared)  ind=12 → 8
vm_idx = next(i for i, l in enumerate(lines) if VM_TAG in l)
vm_end = next(i for i, l in enumerate(lines[vm_idx:vm_idx+80], vm_idx)
              if l.strip() == ")" and l.startswith("            )")
              or (l.strip() == ")" and i > vm_idx + 5 and l.startswith("            ")))
vm_end = next((i for i, l in enumerate(lines[vm_idx:vm_idx+80], vm_idx)
              if l.strip() == ")" and l.startswith("            )")), None)
print(f"\nVM(shared) at L{vm_idx+1}")
for i in range(vm_idx, vm_idx+80):
    if lines[i].strip() == ")" and lines[i].startswith("            ):
        vm_end = i; break
for i in range(vm_idx, vm_end+1):
    if lines[i].startswith("            ") and not lines[i].startswith("                "):
        und = len(lines[i]) - len(lines[i].lstrip())
        if und == 12:
            lines[i] = lines[i][4:]
show(vm_idx, vm_idx+65, "VM(shared) after dedent")

# STEP 4: dedent Generate button block  ind=12 → 8
gen_idx = next(i for i, l in enumerate(lines) if "Generate button" in l)
print(f"\nGen button at L{gen_idx+1}")
for i in range(gen_idx, gen_idx+30):
    if i < len(lines) and lines[i].startswith("            ") and not lines[i].startswith("                "):
        und = len(lines[i]) - len(lines[i].lstrip())
        if und == 12:
            lines[i] = lines[i][4:]
show(gen_idx, gen_idx+25, "Gen button after")

# STEP 5: delete second `selectedNiche && selectedAdjacent && (`
second_w = next((i for i, l in enumerate(lines) if "selectedNiche && selectedAdjacent && (" in l), None)
if second_w:
    del lines[second_w]
    print(f"\nStep 5: deleted second wrapper L{second_w+1}")

# STEP 6: dedent secondary Viral Magnet Picker
vm2_idx = next(i for i, l in enumerate(lines) if VM2_TAG in l)
met_words = next(i for i, l in enumerate(lines[vm2_idx:vm2_idx+80], vm2_idx) if "magnetWords.length > 0" in l)
for i in range(met_words, met_words+200):
    if i >= len(lines): break
    und = len(lines[i]) - len(lines[i].lstrip())
    if und >= 14:
        lines[i] = lines[i][4:]
  vm2_e = next((i for i in range(met_words, len(lines)-1) if lines[i].strip() == "))" and lines[i].startswith("        ))"), None)
print(f"\nSecondary VM L{met_words+1}{' to L'+str(vm2_e+1) if vm2_e else ''}")
show(met_words, met_words+70, "Secondary VM after")

# STEP 7: dedent ideas block  ind=12 → 8
ideas_idx = next(i for i, l in enumerate(lines) if "ideas.length > 0" in l)
ideas_e = None
for i in range(ideas_idx, len(lines)):
    if lines[i].strip() == ")" and len(lines[i])-len(lines[i].lstrip()) == 8:
        ideas_e = i; break
for i in range(ideas_idx, ideas_e+1):
    und = len(lines[i]) - len(lines[i].lstrip())
    if und == 12:
        lines[i] = lines[i][4:]
show(ideas_idx, ideas_e+4, "Ideas after dedent")

# WRITE
txt = "\n".join(lines)
if not txt.endswith("\n"): txt += "\n"
open(p, "w").write(txt)
print(f"\nDone — {len(txt.splitlines())} lines.")
