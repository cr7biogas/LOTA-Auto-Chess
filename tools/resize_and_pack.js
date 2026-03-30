// resize_and_pack.js — Resize outfit textures to 512px, repack as GLB
// Usage: node tools/resize_and_pack.js

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Jimp } = require('jimp');

const SRC_DIR = 'C:/Users/eugen/Desktop/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits';
const OUT_DIR = 'C:/Users/eugen/Desktop/LOTA/models/avatars';
const TMP_DIR = 'C:/Users/eugen/Desktop/LOTA/tools/_tmp_avatars';
const MAX_PX  = 512;

const MAPPING = [
    { classId: 'stratega', outfit: 'Male_Ranger'    },
    { classId: 'stregone', outfit: 'Female_Ranger'  },
    { classId: 'mistico',  outfit: 'Female_Peasant' },
];

async function resizePng(src, dest) {
    const img  = await Jimp.read(src);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    if (w <= MAX_PX && h <= MAX_PX) {
        fs.copyFileSync(src, dest);
        process.stdout.write('  copy  ' + path.basename(src) + '\n');
    } else {
        await img.resize({ w: MAX_PX, h: MAX_PX }).write(dest);
        const before = (fs.statSync(src).size / 1024).toFixed(0);
        const after  = (fs.statSync(dest).size / 1024).toFixed(0);
        process.stdout.write('  ' + path.basename(src) + ': ' + before + 'KB → ' + after + 'KB\n');
    }
}

async function processOutfit(classId, outfit) {
    console.log('\n── ' + classId + ' ← ' + outfit + ' ──');

    const tmpOut = TMP_DIR + '/' + classId;
    if (!fs.existsSync(tmpOut)) fs.mkdirSync(tmpOut, { recursive: true });

    // Copy .gltf and .bin to temp dir
    fs.copyFileSync(SRC_DIR + '/' + outfit + '.gltf', tmpOut + '/' + outfit + '.gltf');
    fs.copyFileSync(SRC_DIR + '/' + outfit + '.bin',  tmpOut + '/' + outfit + '.bin');

    // Find all texture references in the GLTF
    const gltf = JSON.parse(fs.readFileSync(tmpOut + '/' + outfit + '.gltf', 'utf8'));
    const pngs = (gltf.images || []).map(img => img.uri).filter(Boolean);
    console.log('  Textures: ' + pngs.join(', '));

    // Resize each PNG
    for (const png of pngs) {
        const src  = SRC_DIR + '/' + png;
        const dest = tmpOut + '/' + png;
        if (fs.existsSync(src)) {
            await resizePng(src, dest);
        } else {
            console.warn('  WARN: not found: ' + png);
        }
    }

    // Convert to GLB using gltf-pipeline from the temp dir
    const destGlb = OUT_DIR + '/' + classId + '.glb';
    console.log('  Packing → ' + classId + '.glb ...');
    execSync('npx gltf-pipeline -i "' + tmpOut + '/' + outfit + '.gltf" -o "' + destGlb + '"', { stdio: 'pipe' });

    const sizeMB = (fs.statSync(destGlb).size / 1024 / 1024).toFixed(1);
    console.log('  ✓ ' + classId + '.glb — ' + sizeMB + ' MB');
}

async function main() {
    console.log('Resizing textures to max ' + MAX_PX + 'px and repacking...');
    for (const { classId, outfit } of MAPPING) {
        await processOutfit(classId, outfit);
    }
    // Cleanup
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    console.log('\n✓ All avatars packed in models/avatars/');
}

main().catch(err => { console.error(err); process.exit(1); });
