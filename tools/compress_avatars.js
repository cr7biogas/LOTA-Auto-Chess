// compress_avatars.js — Resize outfit textures to 512px and repackage as GLB
// Usage: node tools/compress_avatars.js

const fs   = require('fs');
const path = require('path');
const Jimp = require('jimp');

const PACK_BASE = 'C:/Users/eugen/Desktop/Modular Character Outfits - Fantasy[Standard]';
const GLTF_DIR  = PACK_BASE + '/Exports/glTF (Godot-Unreal)/Outfits';
const TEX_DIRS  = [
    PACK_BASE + '/Textures/Ranger',
    PACK_BASE + '/Textures/Peasant',
    PACK_BASE + '/Textures/Base',
];
const OUT_DIR   = 'C:/Users/eugen/Desktop/LOTA/models/avatars';
const TEX_OUT   = OUT_DIR + '/outfit_textures';
const MAX_SIZE  = 512;

// Avatar class → outfit file mapping
const MAPPING = {
    stratega: 'Male_Ranger',
    stregone: 'Female_Ranger',
    mistico:  'Female_Peasant',
};

async function resizeTexture(srcPath, destPath) {
    try {
        const img = await Jimp.read(srcPath);
        const w = img.bitmap.width;
        const h = img.bitmap.height;
        if (w <= MAX_SIZE && h <= MAX_SIZE) {
            // Already small enough — just copy
            fs.copyFileSync(srcPath, destPath);
            console.log('  copy  ' + path.basename(srcPath) + ' (' + w + 'x' + h + ')');
        } else {
            await img.resize(MAX_SIZE, MAX_SIZE).quality(85).writeAsync(destPath);
            const srcSize  = Math.round(fs.statSync(srcPath).size / 1024);
            const destSize = Math.round(fs.statSync(destPath).size / 1024);
            console.log('  resize ' + path.basename(srcPath) + ' ' + w + 'x' + h + ' → ' + MAX_SIZE + 'x' + MAX_SIZE + ' (' + srcSize + 'KB → ' + destSize + 'KB)');
        }
        return true;
    } catch(e) {
        console.warn('  WARN: could not resize ' + path.basename(srcPath) + ':', e.message);
        return false;
    }
}

function findTexture(name) {
    for (var dir of TEX_DIRS) {
        var p = dir + '/' + name;
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function processOutfit(classId, outfitName) {
    console.log('\n── ' + classId + ' ← ' + outfitName + ' ──');

    var gltfPath = GLTF_DIR + '/' + outfitName + '.gltf';
    var gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));

    if (!fs.existsSync(TEX_OUT)) fs.mkdirSync(TEX_OUT, { recursive: true });

    // Resize all referenced textures
    var texRemap = {}; // original uri → new uri (relative to gltf)
    var images = gltf.images || [];
    for (var img of images) {
        if (!img.uri) continue;
        var srcPath = findTexture(img.uri);
        if (!srcPath) {
            console.warn('  WARN: texture not found:', img.uri);
            continue;
        }
        var destName = img.uri; // keep same name
        var destPath = TEX_OUT + '/' + destName;
        await resizeTexture(srcPath, destPath);
        texRemap[img.uri] = 'outfit_textures/' + destName;
    }

    // Update GLTF image URIs to new relative paths
    var modGltf = JSON.parse(JSON.stringify(gltf)); // deep clone
    (modGltf.images || []).forEach(function(img) {
        if (img.uri && texRemap[img.uri]) img.uri = texRemap[img.uri];
    });

    // Write modified GLTF next to textures
    var tmpGltfPath = OUT_DIR + '/_tmp_' + outfitName + '.gltf';
    fs.writeFileSync(tmpGltfPath, JSON.stringify(modGltf));

    // Use gltf-pipeline to pack into GLB
    var destGlb = OUT_DIR + '/' + classId + '.glb';
    console.log('  Packing → ' + path.basename(destGlb) + '...');

    // Call gltf-pipeline programmatically
    var pipeline = null;
    try { pipeline = require('gltf-pipeline'); } catch(e) {}
    if (!pipeline) {
        // Fallback: shell call
        var { execSync } = require('child_process');
        execSync('npx gltf-pipeline -i "' + tmpGltfPath + '" -o "' + destGlb + '"', { stdio: 'inherit', cwd: OUT_DIR });
    } else {
        var result = await pipeline.gltfToGlb(modGltf, { resourceDirectory: OUT_DIR });
        fs.writeFileSync(destGlb, result.glb);
    }

    // Cleanup temp gltf
    if (fs.existsSync(tmpGltfPath)) fs.unlinkSync(tmpGltfPath);

    var sizeMB = (fs.statSync(destGlb).size / 1024 / 1024).toFixed(1);
    console.log('  ✓ ' + destGlb + ' (' + sizeMB + ' MB)');
}

async function main() {
    console.log('Avatar outfit compression — max texture size: ' + MAX_SIZE + 'px\n');
    for (var [classId, outfitName] of Object.entries(MAPPING)) {
        await processOutfit(classId, outfitName);
    }
    console.log('\n✓ All done!');
}

main().catch(console.error);
