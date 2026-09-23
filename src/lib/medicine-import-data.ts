// Canonical source list for the one-off pharmacy catalog import, transcribed
// from the clinic's supplier price sheet (prices as of the sheet's
// "Price Update: 19.9.2026" column, which supersedes the sheet's older
// printed prices). Shared by scripts/import-medicines.ts (local dev) and
// src/actions/medicine-import-temp.ts (production, via the temporary
// /staff/medicine-import admin page — both removed once the import is done
// everywhere). `generic` holds the active ingredient/composition, stored on
// Medicine.brand since that's the field the portal and promo UI already
// render as a subtitle under the product name.
export type MedicineImportRow = {
  name: string;
  generic: string;
  category: string;
  unit: string;
  price: number;
};

const GASTRO = "Antacids / Gastrointestinal";
const ANTIBIOTIC = "Antibiotics";
const HYPERTENSION = "Antihypertensive / Diuretics";
const ANTITUSSIVE = "Antitussives & Antihistamines";
const CARDIO = "Cardiovascular";
const DIABETIC = "Diabetics";
const DRIP = "Drip";
const INJECTION = "Injection";
const DEVICE = "Medical Device & Instrument";
const MULTIVITAMIN = "Multivitamins / Supplements";
const PAINKILLER = "Painkillers / Analgesics";

export const MEDICINE_IMPORT_DATA: MedicineImportRow[] = [
  // --- Page 1: Antacids / Gastrointestinal ---
  { name: "Asmocid", generic: "Al+Simethicone+MgOH3", category: GASTRO, unit: "box", price: 11000 },
  { name: "Esogut Drops", generic: "Domperidone", category: GASTRO, unit: "bottle", price: 4700 },
  { name: "Dodem 10 (20's)", generic: "Domperidone", category: GASTRO, unit: "box", price: 7500 },
  { name: "Dompy Syrup", generic: "Domperidone", category: GASTRO, unit: "bottle", price: 3200 },
  { name: "Gestrogel Plus (Liquid)", generic: "Al + Simethicone + Mg", category: GASTRO, unit: "bottle", price: 5900 },
  { name: "Konimag", generic: "Alu + Simethicone + Mg", category: GASTRO, unit: "box", price: 18500 },
  { name: "MOM 1000", generic: "Magnesium", category: GASTRO, unit: "bottle", price: 28800 },
  { name: "Ome Inj", generic: "Omeprazole injection", category: GASTRO, unit: "vial", price: 1750 },
  { name: "Panto Inj", generic: "Pantoprazole injection", category: GASTRO, unit: "vial", price: 1350 },
  { name: "Hydro Inj", generic: "Hydrocortisone injection", category: GASTRO, unit: "vial", price: 1550 },
  { name: "Trisec", generic: "Omeprazole 20 mg", category: GASTRO, unit: "box", price: 5500 },
  { name: "R Loc 150", generic: "Ranitidine 150mg", category: GASTRO, unit: "box", price: 12000 },
  { name: "Siloxogene Card", generic: "Al, Mg, Simethicone", category: GASTRO, unit: "box", price: 21500 },
  { name: "Siloxogene Gel", generic: "Al, Mg, Simethicone", category: GASTRO, unit: "bottle", price: 6300 },
  { name: "Sucrafil O Gel", generic: "Sucralfate, Oxetacaine", category: GASTRO, unit: "bottle", price: 7500 },
  { name: "Trisil Plus Pink", generic: "Al+Simethicone+MgOH3", category: GASTRO, unit: "box", price: 14500 },

  // --- Page 1-2: Antibiotics ---
  { name: "Amyn Sy (Amoxicillin 125)", generic: "Amoxicillin", category: ANTIBIOTIC, unit: "bottle", price: 2700 },
  { name: "Avam 375", generic: "Amoxiclav 375", category: ANTIBIOTIC, unit: "box", price: 4000 },
  { name: "Avam 625", generic: "Amoxiclav 625", category: ANTIBIOTIC, unit: "box", price: 9800 },
  { name: "Brumox 250 (Amoxy)", generic: "Amoxicillin 250mg", category: ANTIBIOTIC, unit: "box", price: 9000 },
  { name: "Moxitam 250", generic: "Amoxicillin 250mg", category: ANTIBIOTIC, unit: "box", price: 8800 },
  { name: "Moxitam 500", generic: "Amoxicillin 500mg", category: ANTIBIOTIC, unit: "box", price: 17500 },
  { name: "Neclox (Ampiclox)", generic: "Ampicillin+Cloxacillin", category: ANTIBIOTIC, unit: "box", price: 17100 },
  { name: "Azithromycin 250 (6*10)", generic: "Azithromycin 250mg", category: ANTIBIOTIC, unit: "box", price: 21500 },
  { name: "Azithromycin 500", generic: "Azithromycin 500mg", category: ANTIBIOTIC, unit: "box", price: 18500 },
  { name: "Azithro Powder 100", generic: "Azithromycin 100mg", category: ANTIBIOTIC, unit: "bottle", price: 3200 },
  { name: "Azithro Powder 200", generic: "Azithromycin 200mg", category: ANTIBIOTIC, unit: "bottle", price: 2500 },
  { name: "Cefalexin 250 MC", generic: "Cefalexin 250", category: ANTIBIOTIC, unit: "box", price: 19500 },
  { name: "Cefalexin 500 MC", generic: "Cefalexin 500", category: ANTIBIOTIC, unit: "box", price: 26500 },
  { name: "Cefexim Powder 100", generic: "Cefalexin 125", category: ANTIBIOTIC, unit: "bottle", price: 4300 },
  { name: "Cefexim Powder 50", generic: "Cefexime 50", category: ANTIBIOTIC, unit: "bottle", price: 3400 },
  { name: "Suncexime 100 (Cefexim 100)", generic: "Cefexime 100", category: ANTIBIOTIC, unit: "box", price: 19000 },
  { name: "Sefxi 200 (Cefexim 200) 1 Strip", generic: "Cefexime 200", category: ANTIBIOTIC, unit: "strip", price: 3600 },
  { name: "Cefexim 200 (20 Strips)", generic: "Cefexime 200", category: ANTIBIOTIC, unit: "box", price: 38000 },
  { name: "Ceftriaxone Inj", generic: "Ceftriazone", category: ANTIBIOTIC, unit: "vial", price: 1750 },
  { name: "Cifran Drip", generic: "Ciprofloxacin", category: ANTIBIOTIC, unit: "bottle", price: 1600 },
  { name: "Ciprofloxacin 250 Aorta", generic: "Ciprofloxacin 250", category: ANTIBIOTIC, unit: "box", price: 7700 },
  { name: "Ciprofloxacin 500", generic: "Ciprofloxacin 500", category: ANTIBIOTIC, unit: "box", price: 11500 },
  { name: "CS 1 Inj", generic: "Cefoperazone + Sulbactam", category: ANTIBIOTIC, unit: "vial", price: 2800 },
  { name: "Zeedoxy 150", generic: "Doxycycline", category: ANTIBIOTIC, unit: "box", price: 11000 },
  { name: "Levo Drip", generic: "Levofloxacin", category: ANTIBIOTIC, unit: "bottle", price: 3500 },
  { name: "Metro Drip", generic: "Metronidazole", category: ANTIBIOTIC, unit: "bottle", price: 1700 },
  { name: "Norfloshin", generic: "Norfloxacin", category: ANTIBIOTIC, unit: "box", price: 18700 },
  { name: "Predniza 5", generic: "Prednisone 5mg", category: ANTIBIOTIC, unit: "box", price: 5800 },
  { name: "Levoshin 250", generic: "Levofloxacin 250mg", category: ANTIBIOTIC, unit: "box", price: 14000 },
  { name: "Levo 500", generic: "Levofloxacin 500mg", category: ANTIBIOTIC, unit: "box", price: 19500 },
  { name: "Valmox", generic: "Amoxicillin 500mg + Flucloxacillin", category: ANTIBIOTIC, unit: "box", price: 42500 },

  // --- Page 3-4: Antihypertensive / Diuretics ---
  { name: "Amdep 5", generic: "Amlodipine 5mg", category: HYPERTENSION, unit: "box", price: 5500 },
  { name: "Rhydamlo 5", generic: "Amlodipine 5mg", category: HYPERTENSION, unit: "box", price: 6700 },
  { name: "Amlozen 10", generic: "Amlodipine 10mg", category: HYPERTENSION, unit: "box", price: 7700 },
  { name: "Nifegard 20", generic: "Nifedipine", category: HYPERTENSION, unit: "box", price: 8500 },
  { name: "Losarshin 25", generic: "Losartan 25mg", category: HYPERTENSION, unit: "box", price: 7000 },
  { name: "Meglopin 5", generic: "Amlodipine 5mg", category: HYPERTENSION, unit: "box", price: 5000 },
  { name: "Tapid 10 (Ato 10)", generic: "Atorvastatin 10mg", category: HYPERTENSION, unit: "box", price: 6800 },

  // --- Page 3: Antacids / Gastrointestinal (PPIs, blank category on sheet) ---
  { name: "Pelican 20 (5's)", generic: "Pantoprazole 20mg", category: GASTRO, unit: "strip", price: 4100 },
  { name: "Pent OD 40", generic: "Pantoprazole 40mg", category: GASTRO, unit: "box", price: 7500 },

  // --- Page 3-4: Antitussives & Antihistamines ---
  { name: "Atussin 1000", generic: "Dextromethorphan", category: ANTITUSSIVE, unit: "bottle", price: 53000 },
  { name: "Cetridex Syrup", generic: "Dextro + Ambroxol + Cetrizine", category: ANTITUSSIVE, unit: "bottle", price: 4000 },
  { name: "Detussin", generic: "Dextro + Bromhexine", category: ANTITUSSIVE, unit: "bottle", price: 13500 },
  { name: "Grasovon", generic: "Bromhexine", category: ANTITUSSIVE, unit: "bottle", price: 6500 },
  { name: "Mucoxin", generic: "Bromhexine", category: ANTITUSSIVE, unit: "bottle", price: 4900 },
  { name: "RV Cetrizine Syrup", generic: "Cetrizine", category: ANTITUSSIVE, unit: "bottle", price: 2700 },
  { name: "Sinex Plus Card", generic: "Para, Cetrizine, Phenylephrine", category: ANTITUSSIVE, unit: "box", price: 15500 },
  { name: "Sinex Plus Syrup", generic: "Para, Cetrizine, Phenylephrine", category: ANTITUSSIVE, unit: "bottle", price: 1700 },
  { name: "Ambcet Syrup", generic: "Cetrizine, Ambroxol", category: ANTITUSSIVE, unit: "bottle", price: 4500 },
  { name: "Tussolid", generic: "Chlorpheniramine, Dextro, Guaiphensin, Terpinhydrate", category: ANTITUSSIVE, unit: "box", price: 19500 },

  // --- Page 4: Cardiovascular ---
  { name: "GD Vas 20 (Ato 20)", generic: "Atorvastatin 20mg", category: CARDIO, unit: "box", price: 9800 },
  { name: "Ato 10", generic: "Atorvastatin 10mg", category: CARDIO, unit: "box", price: 11000 },
  { name: "Ato 20", generic: "Atorvastatin 20mg", category: CARDIO, unit: "box", price: 22500 },

  // --- Page 4: Diabetics (as categorized on the source sheet) ---
  { name: "Aspifirst 80", generic: "Aspirin 80mg", category: DIABETIC, unit: "box", price: 9400 },
  { name: "Atemin 50", generic: "Atenolol 50mg", category: DIABETIC, unit: "box", price: 6000 },
  { name: "Catenol 50", generic: "Atenolol 50", category: DIABETIC, unit: "box", price: 13600 },
  { name: "Euroclop 75", generic: "Clopidogrel 75", category: DIABETIC, unit: "box", price: 18000 },
  { name: "Corsprin 75", generic: "Aspirin", category: DIABETIC, unit: "box", price: 6500 },
  { name: "Dimerol MR 30", generic: "Gliclazide MR 30", category: DIABETIC, unit: "box", price: 12500 },
  { name: "Glynora XR-60 (Gliclazide)", generic: "Gliclazide MR 60", category: DIABETIC, unit: "box", price: 20000 },
  { name: "Glid 80", generic: "Gliclazide", category: DIABETIC, unit: "box", price: 19500 },
  { name: "Glycinorm 80", generic: "Gliclazide", category: DIABETIC, unit: "box", price: 16500 },
  { name: "Met Denk 500", generic: "Metformin", category: DIABETIC, unit: "box", price: 24400 },
  { name: "Metforite 500", generic: "Metformin", category: DIABETIC, unit: "box", price: 5500 },
  { name: "Metformin Sachet", generic: "Metformin", category: DIABETIC, unit: "sachet", price: 1600 },
  { name: "Sitatel 100", generic: "Sitagliptin 100", category: DIABETIC, unit: "box", price: 15500 },
  { name: "Sitatel 50", generic: "Sitagliptin 50", category: DIABETIC, unit: "box", price: 12500 },
  { name: "Sitatel M", generic: "Sitagliptin 50, Metformin 500", category: DIABETIC, unit: "box", price: 13500 },

  // --- Page 5: Drip ---
  { name: "DS", generic: "Dextrose with NS", category: DRIP, unit: "bag", price: 3150 },
  { name: "DW", generic: "Dextrose", category: DRIP, unit: "bag", price: 3400 },
  { name: "NS", generic: "Normal Saline", category: DRIP, unit: "bag", price: 3500 },
  { name: "RL", generic: "Ringer Lactate", category: DRIP, unit: "bag", price: 3400 },

  // --- Page 5: Injection ---
  { name: "25% Glucose", generic: "Dextrose Injection", category: INJECTION, unit: "vial", price: 5700 },
  { name: "B12 Inj", generic: "Vitamin B12", category: INJECTION, unit: "vial", price: 3700 },
  { name: "B6 Inj", generic: "Vitamin B6", category: INJECTION, unit: "vial", price: 3700 },
  { name: "Cevit Inj", generic: "Vitamin C", category: INJECTION, unit: "vial", price: 2550 },

  // --- Page 5: Medical Device & Instrument ---
  { name: "Bandage Roll (Pack of 12)", generic: "", category: DEVICE, unit: "pack", price: 6900 },
  { name: "Bandage Roll (Pack of 24)", generic: "", category: DEVICE, unit: "pack", price: 6800 },
  { name: "Syringe 3cc", generic: "", category: DEVICE, unit: "box", price: 18000 },
  { name: "Syringe 5cc", generic: "", category: DEVICE, unit: "box", price: 18500 },
  { name: "Syringe 10cc", generic: "", category: DEVICE, unit: "box", price: 30500 },
  { name: "Syringe 20cc", generic: "", category: DEVICE, unit: "box", price: 22000 },
  { name: "Bandage 3 inch", generic: "", category: DEVICE, unit: "roll", price: 1750 },
  { name: "Bandage 4 inch", generic: "", category: DEVICE, unit: "roll", price: 1900 },
  { name: "Pyopdine 450ml", generic: "Povidone-Iodine", category: DEVICE, unit: "bottle", price: 23500 },
  { name: "Rubber Glove Small", generic: "", category: DEVICE, unit: "box", price: 15000 },
  { name: "Rubber Glove Medium", generic: "", category: DEVICE, unit: "box", price: 14500 },
  { name: "Rubber Glove Large", generic: "", category: DEVICE, unit: "box", price: 15000 },
  { name: "Scalp Vein Set", generic: "", category: DEVICE, unit: "box", price: 25000 },
  { name: "Spirit 500ml", generic: "Isopropyl Alcohol", category: DEVICE, unit: "bottle", price: 1900 },

  // --- Page 5-6: Multivitamins / Supplements ---
  { name: "Vitmic C 500", generic: "Vitamin C", category: MULTIVITAMIN, unit: "box", price: 19000 },
  { name: "Sambee 720", generic: "Vitamin B1, B6, B12", category: MULTIVITAMIN, unit: "box", price: 740 },
  { name: "Super Kids Active", generic: "Vitamin C 100mg", category: MULTIVITAMIN, unit: "bottle", price: 4050 },
  { name: "Super Kids CZ", generic: "Vitamin C, Zinc", category: MULTIVITAMIN, unit: "bottle", price: 6100 },
  { name: "Nutrikids Syrup", generic: "Multivitamin", category: MULTIVITAMIN, unit: "bottle", price: 17700 },
  { name: "Sambee 1000", generic: "Vitamin B1, B6, B12", category: MULTIVITAMIN, unit: "box", price: 69000 },
  { name: "Nuramin Inj", generic: "Vitamin B1, B6, B12", category: MULTIVITAMIN, unit: "box", price: 23000 },

  // --- Page 6: Painkillers / Analgesics ---
  { name: "Asonac 100", generic: "Aceclofenac 100mg", category: PAINKILLER, unit: "box", price: 6800 },
  { name: "Biogesic 120", generic: "Paracetamol", category: PAINKILLER, unit: "bottle", price: 7000 },
  { name: "Biogesic 250", generic: "Paracetamol", category: PAINKILLER, unit: "bottle", price: 9700 },
  { name: "Clofenac Inj", generic: "Diclofenac", category: PAINKILLER, unit: "box", price: 10000 },
  { name: "Unidexa", generic: "Dexamethasone", category: PAINKILLER, unit: "vial", price: 3900 },
  { name: "Dexa Inj ZD", generic: "Dexamethasone", category: PAINKILLER, unit: "vial", price: 2650 },
  { name: "Dicinac Inj (India)", generic: "Diclofenac", category: PAINKILLER, unit: "vial", price: 3800 },
  { name: "Diclo 25 (1000's)", generic: "Diclofenac", category: PAINKILLER, unit: "box", price: 19500 },
  { name: "Diclo Inj (China)", generic: "Diclofenac", category: PAINKILLER, unit: "vial", price: 3400 },
  { name: "Nuosic 1000", generic: "Para + Orphanadrine", category: PAINKILLER, unit: "box", price: 113000 },
  { name: "Para 1000", generic: "Paracetamol 500mg", category: PAINKILLER, unit: "box", price: 31500 },
  { name: "Paragen Drops 15ml", generic: "Paracetamol Drops", category: PAINKILLER, unit: "bottle", price: 6500 },
  { name: "Paragesic", generic: "Paracetamol 500mg", category: PAINKILLER, unit: "box", price: 6850 },
  { name: "Param 125 (Strawberry/Orange)", generic: "Paracetamol 125mg", category: PAINKILLER, unit: "bottle", price: 1250 },
  { name: "Parasafe 125", generic: "Paracetamol 125mg", category: PAINKILLER, unit: "bottle", price: 3700 },
  { name: "Parasafe 250", generic: "Paracetamol 250mg", category: PAINKILLER, unit: "box", price: 4850 },
  { name: "Paraxy 250", generic: "Paracetamol 250mg", category: PAINKILLER, unit: "box", price: 2800 },
  { name: "PB Tamol 250", generic: "Paracetamol 250mg", category: PAINKILLER, unit: "box", price: 4300 },
  { name: "Sara 120", generic: "Paracetamol 120mg", category: PAINKILLER, unit: "bottle", price: 6300 },
  { name: "Sara 250", generic: "Paracetamol 250mg", category: PAINKILLER, unit: "box", price: 8100 },
];
