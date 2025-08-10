// =================================================================
//                     Shader Simulator - Version 6.1
//                   Expanded GLSL Function Library
// =================================================================

console.log('Script starting...');

// --- TRANSPILER ---
function simpleGlslToJs(glslCode) {
    try {
        let lines = glslCode.split('\n');
        let jsLines = [];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('//') || line.startsWith('void main()') || line === '{' || line === '}') {
                continue;
            }

            if (line.endsWith(';')) {
                line = line.slice(0, -1);
            }

            //  We add our functions to the replace list.
            let jsLine = line
                .replace(/vec2\(/g, 'glsl_lib.vec2(')
                .replace(/vec3\(/g, 'glsl_lib.vec3(')
                .replace(/vec4\(/g, 'glsl_lib.vec4(')
                .replace(/mix\(/g, 'glsl_lib.mix(')
                .replace(/step\(/g, 'glsl_lib.step(')
                .replace(/distance\(/g, 'glsl_lib.distance(')
                .replace(/sin\(/g, 'Math.sin(')
                .replace(/cos\(/g, 'Math.cos(')
                .replace(/pow\(/g, 'Math.pow(');

            if (jsLine.startsWith('gl_FragColor')) {
                jsLine = jsLine.replace(/gl_FragColor\s*=\s*(.*)/, 'gl_FragColor.assign($1)');
            }
            else if (jsLine.includes('=')) {
                jsLine = jsLine.replace(/^(float|int|vec[234])\s+/, 'let ');
            }

            jsLines.push(jsLine + ';');
        }

        let jsCode = jsLines.join('\n');
        return new Function('uv', 'time', 'gl_FragColor', 'glsl_lib', jsCode);

    } catch (error) {
        console.error("Simple Transpiler Error:", error.message);
        return null;
    }
}

// --- INITIALIZATION ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' } });
require(['vs/editor/editor.main'], () => {
    initializeApp();
});


function initializeApp() {
    console.log('initializeApp called!');

    let editor = null;

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- We add the function implementations. ---
    const glsl_lib = {
        Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
        Vector3: class {
            constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
            
            // THE FIX IS HERE: Use `this.constructor` to create a new instance of the same class.
            multiplyScalar(s) {
                return new this.constructor(this.x * s, this.y * s, this.z * s);
            }
            add(other) {
                return new this.constructor(this.x + other.x, this.y + other.y, this.z + other.z);
            }
        },
        Vector4: class {
            constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; }
            assign(otherVec4) {
                if (otherVec4) {
                    this.x = otherVec4.x; this.y = otherVec4.y; this.z = otherVec4.z; this.w = otherVec4.w;
                }
                return this;
            }
        },
        vec2: (x, y) => new glsl_lib.Vector2(x, y),
        vec3: (x, y, z) => new glsl_lib.Vector3(x, y, z),
        vec4: function () {
            if (arguments.length === 4) return new glsl_lib.Vector4(arguments[0], arguments[1], arguments[2], arguments[3]);
            if (arguments.length === 2 && arguments[0] instanceof glsl_lib.Vector3) return new glsl_lib.Vector4(arguments[0].x, arguments[0].y, arguments[0].z, arguments[1]);
            return new glsl_lib.Vector4();
        },
        mix: (a, b, t) => {
            if (typeof a === 'number') {
                return a * (1.0 - t) + b * t;
            } else {
                // This now works correctly because the methods inside Vector3 are fixed.
                return a.multiplyScalar(1.0 - t).add(b.multiplyScalar(t));
            }
        },
        step: (edge, x) => {
            return x < edge ? 0.0 : 1.0;
        },
        distance: (p0, p1) => {
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dz = (p1.z !== undefined && p0.z !== undefined) ? p1.z - p0.z : 0;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    };

    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    let compiledShader = null;
    let startTime = performance.now();

    function recompileShader() {
        const glslCode = editor.getValue();
        compiledShader = simpleGlslToJs(glslCode);
        if (!compiledShader) {
            console.error('Shader compilation failed!');
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, width, height);
        }
    }

    function render(currentTime) {
        if (!compiledShader) {
            requestAnimationFrame(render);
            return;
        }
        const time = (currentTime - startTime) / 1000.0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const uv = new glsl_lib.Vector2(x / width, (height - 1 - y) / height);
                let gl_FragColor = new glsl_lib.Vector4(0, 0, 0, 1);

                try {
                    compiledShader(uv, time, gl_FragColor, glsl_lib);
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex] = Math.floor(gl_FragColor.x * 255);
                    data[pixelIndex + 1] = Math.floor(gl_FragColor.y * 255);
                    data[pixelIndex + 2] = Math.floor(gl_FragColor.z * 255);
                    data[pixelIndex + 3] = 255;
                } catch (error) {
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex] = 255; data[pixelIndex + 1] = 0; data[pixelIndex + 2] = 0; data[pixelIndex + 3] = 255;
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        requestAnimationFrame(render);
    }

    // --- SETUP AND INITIAL RUN ---
    // Let's provide a new initial code that uses our new functions!
    const initialCode = [
        '// Now with a fully working vector mix()!',
        'void main() {',
        '    vec2 center = vec2(0.5, 0.5);',
        '    float d = distance(uv, center);',
        '',
        '    // Define two colors',
        '    vec3 colorA = vec3(1.0, 0.5, 0.0); // Orange',
        '    vec3 colorB = vec3(0.0, 0.5, 1.0); // Blue',
        '',
        '    // Mix the colors based on distance from the center.',
        '    // A value of 0 for `d` gives colorA, a value of 0.5 gives colorB.',
        '    vec3 finalColor = mix(colorA, colorB, d * 2.0);',
        '',
        '    gl_FragColor = vec4(finalColor, 1.0);',
        '}'
    ].join('\n');
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: initialCode, language: 'glsl', theme: 'vs-dark'
    });

    editor.onDidChangeModelContent(debounce(recompileShader, 250));
    recompileShader();
    requestAnimationFrame(render);
}