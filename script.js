// =================================================================
//                     Shader Simulator - Version 6.0
//                   Animation with a `time` Uniform
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

            let jsLine = line
                .replace(/vec2\(/g, 'glsl_lib.vec2(')
                .replace(/vec3\(/g, 'glsl_lib.vec3(')
                .replace(/vec4\(/g, 'glsl_lib.vec4(')
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
        
        // THE CHANGE IS HERE: We add `time` to the list of arguments for our function.
        return new Function('uv', 'time', 'gl_FragColor', 'glsl_lib', jsCode);

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

    // We no longer need debounce for the animation loop, but it's good to keep for other things.
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
                    this.x = otherVec4.x; this.y = otherVec4.y; this.z = otherVec4.z; this.w = otherVec4.w;
                }
                return this;
            }
        },
        vec2: (x,y) => new glsl_lib.Vector2(x,y),
        vec3: (x,y,z) => new glsl_lib.Vector3(x,y,z),
        vec4: function() {
            if (arguments.length === 4) return new glsl_lib.Vector4(arguments[0], arguments[1], arguments[2], arguments[3]);
            if (arguments.length === 2 && arguments[0] instanceof glsl_lib.Vector3) return new glsl_lib.Vector4(arguments[0].x, arguments[0].y, arguments[0].z, arguments[1]);
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
    let startTime = performance.now(); // Store the time when the app starts.

    // This function recompiles the shader. It's called when the code changes.
    function recompileShader() {
        const glslCode = editor.getValue();
        compiledShader = simpleGlslToJs(glslCode);
        if (!compiledShader) {
            console.error('Shader compilation failed!');
            // We'll stop the animation loop if the shader is broken.
            // The error will be visible on the canvas.
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, width, height);
        }
    }

    // This is the main rendering function, called on every frame.
    function render(currentTime) {
        if (!compiledShader) {
            // If the shader is broken, don't try to render.
            requestAnimationFrame(render);
            return;
        }

        // Calculate elapsed time in seconds.
        const time = (currentTime - startTime) / 1000.0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const uv = new glsl_lib.Vector2(x / width, (height - 1 - y) / height);
                let gl_FragColor = new glsl_lib.Vector4(0, 0, 0, 1);
                
                try {
                    // THE CHANGE IS HERE: We pass the current `time` to the shader.
                    compiledShader(uv, time, gl_FragColor, glsl_lib);
                    
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex]     = Math.floor(gl_FragColor.x * 255);
                    data[pixelIndex + 1] = Math.floor(gl_FragColor.y * 255);
                    data[pixelIndex + 2] = Math.floor(gl_FragColor.z * 255);
                    data[pixelIndex + 3] = 255;
                } catch (error) {
                    // This catch is less likely to be hit now, but good to keep.
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex] = 255; data[pixelIndex+1] = 0; data[pixelIndex+2] = 0; data[pixelIndex+3] = 255;
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Request the next frame, creating the animation loop.
        requestAnimationFrame(render);
    }

    // --- SETUP AND INITIAL RUN ---
    const initialCode = [
        '// The `time` variable is now available!',
        '// It contains the number of seconds since the page loaded.',
        'void main() {',
        '    float r = 0.5 + 0.5 * cos(time);',
        '    float g = 0.5 + 0.5 * cos(time + 2.0);',
        '    float b = 0.5 + 0.5 * cos(time + 4.0);',
        '    vec3 color = vec3(r, g, b);',
        '    gl_FragColor = vec4(color, 1.0);',
        '}'
    ].join('\n');
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: initialCode, language: 'glsl', theme: 'vs-dark'
    });

    // When the user types, we just recompile. The animation loop will handle rendering.
    editor.onDidChangeModelContent(debounce(recompileShader, 250));
    
    // Initial compilation
    recompileShader();

    // Start the animation loop!
    requestAnimationFrame(render);
}