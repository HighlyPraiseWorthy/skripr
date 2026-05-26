"""fix_nb.py - one-shot structural repair of niche-bend/page.tsx"""
from pathlib import Path

p = Path("/Users/antondavids/workspace/skripr/src/app/dashboard/niche-bend/page.tsx")
lines = p.read_text().splitlines()
n0 = len(lines)
print(f"Start: {n0} lines")

VM_TAG   = "/* \u2500\u2500 Viral Magnet (shared) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */"
VM2_TAG  = "/* \u2500\u2500\u2500 Viral Magnet Picker \u2500\u2500\u2500 */"
H3       = "Bend Potential Score"

def show(s, e, lbl):
    print(f"\n--- {lbl} ---")
    for i in range(s, min(e, len(lines))):
        ind = len(lines[i]) - len(lines[i].lstrip())
        print(f"  L{i+1} ind={ind:2} | {lines[i].strip()[:80]}")

# STEP 1: L441 HTML → JSX comment
assert "<!-- \u2500\u2500 Score card \u2500\u2500 -->" in lines[440]
lines[440] = "            {/* \u2500\u2500 Score card \u2500\u2500 */}"
print("Step 1: L441 done.")

# STEP 2a: delete stray )})
# L477=</div> (correct, closes score card), L478=)} (stray, ind=8 correct close)
# L479 is now the stray ind=12 )}
assert lines[477].strip() == "</div>" and lines[478].strip() == ")"
show(477, 491, "Before stray+duplicate deletion")
lines.pop(478)   # delete L479 (was ind=12 stray })
print("Step 2a: stray line deleted.")

# STEP 2b: delete duplicate score card
assert H3 in lines[478], f"Expected duplicate h3, got: {lines[478]!r}"
dup_end = None
for i in range(478, len(lines)):
    if lines[i].strip() == ")" and lines[i].startswith("            )"):
        dup_end = i
        break
assert dup_end, "dup end not found"
print(f"Deleting duplicate score card L479-{dup_end+1}")
del lines[478:dup_end+1]
show(476, 496, "After duplicate deletion")

# STEP 3: dedent Viral Magnet (shared) block  ind=12 → 8
vm_idx = next(i for i, l in enumerate(lines) if VM_TAG in l)
print(f"\nVM(shared) at L{vm_idx+1} ind={len(lines[vm_idx])-len(lines[vm_idx].lstrip())}")
vm_end = None
for i in range(vm_idx, vm_idx+80):
    if lines[i].strip() == ")" and lines[i].startswith("            )"):
        vm_end = i
        break
assert vm_end
for i in range(vm_idx, vm_end+1):
    if lines[i].startswith("            ") and not lines[i].startswith("                "):
        und = len(lines[i]) - len(lines[i].lstrip())
        if und == 12:
            lines[i] = lines[i][4:]
print(f"VM(shared) dedented L{vm_idx+1}-{vm_end+1}")
show(vm_idx, vm_end+5, "VM(shared) after")

# STEP 4: dedent Generate button block  ind=12 → 8
gen_idx = next(i for i, l in enumerate(lines) if "Generate button" in l)
print(f"\nGen button at L{gen_idx+1}")
for i in range(gen_idx, gen_idx+30):
    if i < len(lines) and lines[i].startswith("            ") and not lines[i].startswith("                "):
        und = len(lines[i]) - len(lines[i].lstrip())
        if und == 12:
            lines[i] = lines[i][4:]
show(gen_idx, gen_idx+30, "Gen button after")

# STEP 5: delete second `selectedNiche && selectedAdjacent && (`
for i, l in enumerate(lines):
    if "selectedNiche && selectedAdjacent && (" in l:
        print(f"\nStep 5: Delete second wrapper at L{i+1}: {l[:60]!r}")
        del lines[i]
        break

# STEP 6: dedent secondary Viral Magnet Picker block
vm2_idx = next(i for i, l in enumerate(lines) if VM2_TAG in l)
show(vm2_idx, vm2_idx+80, "Secondary VM before")
vm2_s = vm2_idx
# Find `{magnetWords.length > 0` anchor
for i in range(vm2_idx, vm2_idx+80):
    if "magnetWords.length > 0" in lines[i]:
        vm2_s = i
        break
# Dedent all ind>=14 lines
for i in range(vm2_s, vm2_s+200):
    if i >= len(lines):
        break
    und = len(lines[i]) - len(lines[i].lstrip())
    if und >= 14:
        lines[i] = lines[i][4:]
# Find end
vm2_e = None
for i in range(vm2_s, len(lines)-1, -1):
    if lines[i].strip() == "))" and lines[i].startswith("        )):
        vm2_e = i
        break
print(f"Secondary VM after: L{vm2_s+1}-{vm2_e+1 if vm2_e else '?'}")
show(vm2_s, vm2_s+70, "Secondary VM after")

# STEP 7: dedent ideas block  ind=12 → 8
ideas_idx = next(i for i, l in enumerate(lines) if "ideas.length > 0" in l)
print(f"\nIdeas at L{ideas_idx+1}")
# dedent
ideas_e = None
for i in range(ideas_idx, len(lines)):
    ind = len(lines[i]) - len(lines[i].lstrip())
    if lines[i].strip() == ")" and ind == 8:
        ideas_e = i
        break
for i in range(ideas_idx, ideas_e+1):
    und = len(lines[i]) - len(lines[i].lstrip())
    if und == 12:
        lines[i] = lines[i][4:]
print(f"Ideas dedented L{ideas_idx+1}-{ideas_e+1}")

# WRITE
txt = "\n".join(lines)
if not txt.endswith("\n"):
    txt += "\n"
p.write_text(txt)
print(f"\nDone — {len(txt.splitlines())} lines ({len(txt)} bytes)")
