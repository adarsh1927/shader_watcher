// =================================================================
//                     Shader Simulator - Version 5.5
//                The Final, Correct, Working Transpiler
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
            
            // --- THE FIX IS HERE ---
            // We now handle semicolons explicitly to avoid errors.

            // Step 1: Remove any existing semicolon for clean processing.
            if (line.endsWith(';')) {
                line = line.slice(0, -1);
            }

            // Step 2: General replacements.
            let jsLine = line
                .replace(/vec2\(/g, 'glsl_lib.vec2(')
                .replace(/vec3\(/g, 'glsl_lib.vec3(')
                .replace(/vec4\(/g, 'glsl_lib.vec4(')
                .replace(/sin\(/g, 'Math.sin(')
                .replace(/cos\(/g, 'Math.cos(')
                .replace(/pow\(/g, 'Math.pow(');

            // Step 3: Convert `gl_FragColor = ...` into a method call.
            // Because we removed the semicolon, the `(.*)` is now clean.
            if (jsLine.startsWith('gl_FragColor')) {
                 jsLine = jsLine.replace(/gl_FragColor\s*=\s*(.*)/, 'gl_FragColor.assign($1)');
            }
            // Step 4: Convert GLSL variable declarations to JS `let`
            else if (jsLine.includes('=')) {
                jsLine = jsLine.replace(/^(float|int|vec[234])\s+/, 'let ');
            }
            
            // Step 5: Add a semicolon back to the completed line.
            jsLines.push(jsLine + ';');
        }
        
        let jsCode = jsLines.join('\n');
        console.log("Transpiled JS code:\n" + jsCode); // Log the generated code for debugging
        
        return new Function('uv', 'gl_FragColor', 'glsl_lib', jsCode);
    } catch (error) {
        console.error("Simple Transpiler Error:", error.message);
        return null;
    }
}

// --- INITIALIZATION ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
require(['vs/editor/editor.main'], () => {
    initializeApp();
});


function initializeApp() {
    console.log('initializeApp called!');
    
    let editor = null;

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const glsl_lib = {
        Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
        Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
        Vector4: class {
            constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; }
            assign(otherVec4) {
                if (otherVec4) {
                    this.x = otherVec4.x;
                    this.y = otherVec4.y;
                    this.z = otherVec4.z;
                    this.w = otherVec4.w;
                }
                return this;
            }
        },
        vec2: (x,y) => new glsl_lib.Vector2(x,y),
        vec3: (x,y,z) => new glsl_lib.Vector3(x,y,z),
        vec4: function() {
            if (arguments.length === 4) {
                return new glsl_lib.Vector4(arguments[0], arguments[1], arguments[2], arguments[3]);
            }
            if (arguments.length === 2 && arguments[0] instanceof glsl_lib.Vector3) {
                const vec3 = arguments[0];
                const w = arguments[1];
                return new glsl_lib.Vector4(vec3.x, vec3.y, vec3.z, w);
            }
            return new glsl_lib.Vector4();
        },
    };

    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    let compiledShader = null;

    function runSimulation(glslCode) {
        compiledShader = simpleGlslToJs(glslCode);
        if (!compiledShader) {
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const uv = new glsl_lib.Vector2(x / width, (height - 1 - y) / height);
                let gl_FragColor = new glsl_lib.Vector4(0, 0, 0, 1);
                
                try {
                    compiledShader(uv, gl_FragColor, glsl_lib);
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex]     = Math.floor(gl_FragColor.x * 255);
                    data[pixelIndex + 1] = Math.floor(gl_FragColor.y * 255);
                    data[pixelIndex + 2] = Math.floor(gl_FragColor.z * 255);
                    data[pixelIndex + 3] = 255;
                } catch (error) {
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex]     = 255; data[pixelIndex + 1] = 0; data[pixelIndex + 2] = 0; data[pixelIndex + 3] = 255;
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    const initialCode = [
        '// It works! GLSL assignment is now correctly',
        '// translated to JS object modification.',
        'void main() {',
        '    vec3 color = vec3(uv.x, uv.y, 0.5);',
        '    gl_FragColor = vec4(color, 1.0);',
        '}'
    ].join('\n');
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: initialCode, language: 'glsl', theme: 'vs-dark'
    });
    editor.onDidChangeModelContent(debounce(() => {
        runSimulation(editor.getValue());
    }, 250));
    
    runSimulation(initialCode);
}