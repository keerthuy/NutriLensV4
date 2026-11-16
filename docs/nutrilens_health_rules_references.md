# NutriLens Health Rules & Clinical Guidelines References

This document outlines the clinical references, dietary guidelines, and threshold criteria underpinning the NutriLens Recommendation Engine and Health Rules Evaluator.

---

## 1. Guideline Sources

### A. Diabetes (Glycemic & Carbohydrate Management)
- **Reference**: American Diabetes Association (ADA) Standards of Care in Diabetes (2024 / 2026 update).
- **Criteria**:
  - **Glycemic Index (GI)**: Low GI ($\le 55$) prevents rapid postprandial glucose excursions. Medium GI (56–69) requires moderation; High GI ($\ge 70$) is restricted.
  - **Sugars**: Free/available sugar $\le 5.0\text{g} / 100\text{g}$ qualifies as low-sugar (consistent with UK FSA low-sugar classification).
  - **Dietary Fiber**: High fiber ($\ge 2.5\text{g} / 100\text{g}$, target $\ge 3.0\text{g} / 100\text{g}$) slows starch hydrolysis and improves insulin sensitivity.
- **Evaluation Rule**: A produce item qualifies for diabetes if `glycemicIndex === 'low'`, `sugar_g <= THRESHOLDS.diabetes.maxSugar_g`, and `fiber_g >= THRESHOLDS.diabetes.minFiber_g`.

---

### B. High Blood Pressure (Hypertension / DASH Diet)
- **Reference**: American Heart Association (AHA) / American College of Cardiology (ACC) & Dietary Approaches to Stop Hypertension (DASH) Diet Guidelines.
- **Criteria**:
  - **Sodium**: Strict sodium restriction $\le 50\text{mg} / 100\text{g}$ (produce baseline) and $\le 120\text{mg} / 100\text{g}$ for low-sodium packaged foods (UK FSA Front-of-Pack Guidance).
  - **Potassium**: Potassium-rich foods ($\ge 250\text{mg} / 100\text{g}$) promote natriuresis and vasodilation, lowering systolic and diastolic arterial blood pressure.
- **Evaluation Rule**: Qualifies if `sodium_mg <= THRESHOLDS.high_blood_pressure.maxSodium_mg` and `potassium_mg >= THRESHOLDS.high_blood_pressure.minPotassium_mg` (unless Kidney Disease is concurrently present).

---

### C. Kidney Disease (Chronic Kidney Disease / CKD)
- **Reference**: Kidney Disease: Improving Global Outcomes (KDIGO) Clinical Practice Guideline for Diabetes and CKD; National Kidney Foundation (NKF) KDOQI Guidelines.
- **Criteria**:
  - **Potassium Restriction**: Impaired glomerular filtration and reduced tubular secretion lead to hyperkalemia. Low-potassium produce is strictly classified as $\le 200\text{mg} / 100\text{g}$ (foods $> 200\text{mg}$–$250\text{mg} / 100\text{g}$ such as bananas, spinach, and avocados must be restricted or avoided).
  - **Phosphorus Restriction**: Retention of serum phosphate causes mineral and bone disorder (CKD-MBD). Produce threshold $\le 50\text{mg} / 100\text{g}$.
  - **Sodium Restriction**: Sodium retention exacerbates fluid overload and hypertension ($\le 50\text{mg} / 100\text{g}$).
- **Evaluation Rule**: Qualifies if `potassium_mg <= THRESHOLDS.kidney_disease.maxPotassium_mg`, `phosphorus_mg <= THRESHOLDS.kidney_disease.maxPhosphorus_mg`, and `sodium_mg <= THRESHOLDS.kidney_disease.maxSodium_mg`.

---

### D. Heart Disease & High Cholesterol (Cardiovascular Health)
- **Reference**: American Heart Association (AHA) Dietary Recommendations; European Society of Cardiology (ESC) Dyslipidemia Guidelines; UK Food Standards Agency (FSA).
- **Criteria**:
  - **Saturated Fat**: Low saturated fat $\le 0.5\text{g} / 100\text{g}$ for fresh produce, $\le 1.5\text{g} / 100\text{g}$ for packaged products (FSA low sat-fat limit).
  - **Dietary Fiber**: Soluble and insoluble fiber $\ge 2.5\text{g} / 100\text{g}$ binds bile acids, reducing low-density lipoprotein (LDL) cholesterol and cardiovascular risk.
  - **Sodium**: Cardiovascular protection requires sodium control ($\le 100\text{mg} / 100\text{g}$).
- **Evaluation Rule**: Qualifies if `saturatedFat_g <= THRESHOLDS.heart_disease.maxSatFat_g`, `fiber_g >= THRESHOLDS.heart_disease.minFiber_g`, and `sodium_mg <= THRESHOLDS.heart_disease.maxSodium_mg`.

---

## 2. Clinical Conflict Hierarchy: Renal Safety vs. DASH Diet

### The Potassium Paradox
- **DASH Diet for Hypertension**: Recommends elevated potassium intake ($\ge 250\text{mg} / 100\text{g}$) to lower blood pressure.
- **Renal Diet for Kidney Disease**: Mandates low potassium intake ($\le 200\text{mg} / 100\text{g}$) to prevent hyperkalemia ($K^+ > 5.5\,\text{mmol/L}$), which carries acute risk of cardiac arrhythmias and cardiac arrest.
- **Resolution Strategy**: When a member has **both** `kidney_disease` and `high_blood_pressure`, **Renal Safety takes absolute precedence**. High-potassium foods (e.g. spinach, bananas, sweet potatoes, avocados) are strictly disallowed, and only foods satisfying `potassium_mg <= 200mg` are recommended with DASH sodium control.

---

## 3. Allergen Hard Filter Safety
In accordance with FDA Food Allergen Labeling and Consumer Protection Act (FALCPA) and EU Regulation 1169/2011:
- Any food containing or cross-contacting a diagnosed allergen (dairy, egg, tree nuts, fish, gluten, wheat, sesame, seafood, peanuts, soy) is excluded with 100% hard filtering without tolerance or relaxation.

---

## 4. Sensitivity Analysis (One-At-A-Time ±20% Tuning)
All numerical thresholds in `src/data/produceCatalog.ts` are stored in a centralized, exported configuration object (`PRODUCE_THRESHOLDS`), facilitating automated One-At-A-Time (OAT) parameter variation analysis ($\pm 20\%$) to test model robustness and stability.

