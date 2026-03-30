# 🧪 LOTA AUTO CHESS — TEST MODELLI KENNEY

## CHECKLIST DI VALIDAZIONE

### ✅ PRIMA DI AVVIARE

- [ ] Verifica che tutti i file siano in posto:
  - [ ] `models/kenney/*.glb` (25 files)
  - [ ] `js/three-environment.js`
  - [ ] `index.html` contiene GLTFLoader script
  - [ ] `js/game.js` contiene call a initThreeEnvironment()

- [ ] Verifica struttura:
  ```bash
  ls -la LOTA/models/kenney/*.glb | wc -l  # Deve essere 25
  grep -c "GLTFLoader" LOTA/index.html     # Deve essere >= 1
  grep -c "initThreeEnvironment" LOTA/js/game.js  # Deve essere >= 1
  ```

---

### 🎮 DURANTE IL GIOCO

#### **AMBIENTE ARENA**

| Test | Aspettativa | Status |
|---|---|---|
| Floor visibile | Arena 14x14 ha texture/maglia | ☐ PASS / ☐ FAIL |
| Muri perimetro | 4 lati arena hanno muri | ☐ PASS / ☐ FAIL |
| Gates visibili | 4 gate (N,S,E,W) posizionati | ☐ PASS / ☐ FAIL |
| Colonne spigoli | 4 colonne agli angoli | ☐ PASS / ☐ FAIL |
| Stairs visibili | 2 scalinate a N e S | ☐ PASS / ☐ FAIL |
| Rocce/Pietre | Decorazioni sparse intorno | ☐ PASS / ☐ FAIL |
| Banners | 4 bandiere (colorate?) | ☐ PASS / ☐ FAIL |

#### **RENDERING & PERFORMANCE**

| Test | Aspettativa | Status |
|---|---|---|
| Nessun errore console | Console.log pulita (no red errors) | ☐ PASS / ☐ FAIL |
| Shadow casting | Modelli proiettano ombre | ☐ PASS / ☐ FAIL |
| Smooth 60 FPS | Game loop non scatta | ☐ PASS / ☐ FAIL |
| Modelli carichi | GLB cache contiene modelli | ☐ PASS / ☐ FAIL |

#### **INTERAZIONE GIOCO**

| Test | Aspettativa | Status |
|---|---|---|
| Unità visibili | Personaggi ancora visibili over modelli | ☐ PASS / ☐ FAIL |
| Click selecting | Toccare tile seleziona unità | ☐ PASS / ☐ FAIL |
| Combat avviato | Modelli non interferiscono con physics | ☐ PASS / ☐ FAIL |
| Loot drop (future) | Coins galleggiano quando kill | ☐ PASS / ☐ FAIL |

---

### 🔍 VERIFICA CONSOLE

Aprire F12 (Developer Tools) e verificare:

#### Console Logs (attesi):
```
✓ Environment initialized
✓ All environment elements loaded
```

#### Errors NON attesi:
```
❌ Error loading GLB model
❌ Cannot find property 'GLTFLoader'
❌ Failed to fetch models/kenney/...
```

#### Warnings (OK):
```
⚠️ GLTFLoader not ready yet (first frame)
⚠️ Model path relative to HTML (normale)
```

---

### 📊 DEBUGGING - SCREENSHOT/NOTES

#### Se problemi, raccogliere:

1. **Screenshot console error:**
   - Foto dello screenshot error
   - URL completo del file mancante

2. **Network tab:**
   - Filtro per "kenney" nel Network tab
   - Verificare che richieste avvengono
   - HTTP status code (200 = OK, 404 = NOT FOUND)

3. **Three.js Inspector:**
   - Aprire scene tree (F12 → Console)
   - Digitare: `threeScene.children.length`
   - Deve includere threeEnvironmentGroup

---

### ✨ BONUS - FEATURES PER TESTARE DOPO

Una volta ambiente funzionante:

- [ ] Modelli boss/creeps
- [ ] Item drop animati
- [ ] Weapon equipped visibili
- [ ] Team banner colors
- [ ] Texture mapping avanzato

---

## 🚀 RISULTATO FINALE

### SUCCESS ✅
Se tutti i test passano:
1. Ambiente 3D Kenney completamente integrato
2. Pronto per aggiungere custom modelli (boss, items)
3. Foundation solida per VFX & animations

### NEXT STEPS
1. Test on different browsers/devices
2. Profiling performance (if FPS drops)
3. Create boss/item models
4. Polish final visual

---

**Inizio Test:** [data/ora]
**Completato:** [data/ora]
**Tester:** [nome]
**Note finali:**
```
[spazio per note]
```
