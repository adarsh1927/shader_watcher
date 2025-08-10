// Since our script tag is at the end of the <body>, the HTML elements
// are already available. We can start our main logic immediately.

console.log('Script starting...');
console.log('require available?', typeof require !== 'undefined');

// Robust GLSL to JS transpiler (no external dependencies needed)
function simpleGlslToJs(glslCode) {
    try {
        // Parse the GLSL code more intelligently
        let lines = glslCode.split('\n');
        let jsLines = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('//') || line.startsWith('void main()') || line === '{' || line === '}') {
                continue; // Skip comments, function declaration, and braces
            }
            
            // Convert GLSL syntax to JavaScript
            let jsLine = line
                .replace(/vec2\s*\(/g, 'glsl_lib.vec2(')
                .replace(/vec3\s*\(/g, 'glsl_lib.vec3(')
                .replace(/vec4\s*\(/g, 'glsl_lib.vec4(')
                .replace(/sin\s*\(/g, 'Math.sin(')
                .replace(/cos\s*\(/g, 'Math.cos(')
                .replace(/pow\s*\(/g, 'Math.pow(')
                .replace(/sqrt\s*\(/g, 'Math.sqrt(')
                .replace(/abs\s*\(/g, 'Math.abs(')
                .replace(/floor\s*\(/g, 'Math.floor(')
                .replace(/ceil\s*\(/g, 'Math.ceil(')
                .replace(/fract\s*\(/g, 'x => x - Math.floor(x)');
            
            // Special handling for gl_FragColor assignments
            if (jsLine.includes('gl_FragColor = ')) {
                // Replace gl_FragColor = vec4(...) with gl_FragColor.set(...)
                jsLine = jsLine.replace(/gl_FragColor\s*=\s*glsl_lib\.vec4\(([^)]+)\)/, 'gl_FragColor.set($1)');
            }
            
            // Ensure proper JavaScript syntax
            if (jsLine.includes('=') && !jsLine.includes('let ') && !jsLine.includes('const ') && !jsLine.includes('var ') && !jsLine.includes('gl_FragColor.set(')) {
                // Remove GLSL type declarations and add 'let'
                jsLine = jsLine.replace(/^(vec[234]|float|int)\s+/, 'let ');
            }
            
            // Ensure semicolon at the end
            if (jsLine && !jsLine.endsWith(';')) {
                jsLine += ';';
            }
            
            if (jsLine) {
                jsLines.push(jsLine);
            }
        }
        
        let jsCode = jsLines.join('\n');
        console.log('Transpiled JS code:', jsCode);
        
        return new Function('uv', 'gl_FragColor', 'glsl_lib', jsCode);
    } catch (error) {
        console.error("Simple Transpiler Error:", error.message);
        console.error("Original GLSL:", glslCode);
        return null;
    }
}

// Initialize Monaco directly since we don't need to wait for GLSL parser
function initializeMonaco() {
    // First, configure Monaco's loader. This runs because `loader.min.js` has already executed.
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});

    console.log('Monaco require configured, loading editor...');

    // Now, tell Monaco to load its main component. The code inside will
    // run once the editor itself is ready.
    require(['vs/editor/editor.main'], () => {
        console.log('Monaco editor loaded!');
        
        // Monaco is ready, initialize the app
        initializeApp();
    });
}

// Start the loading process
initializeMonaco();

// This function contains our entire application logic.
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
        Vector2: class { 
            constructor(x = 0, y = 0) { 
                this.x = x; 
                this.y = y; 
            } 
        },
        Vector3: class { 
            constructor(x = 0, y = 0, z = 0) { 
                this.x = x; 
                this.y = y; 
                this.z = z; 
            } 
        },
        Vector4: class {
            constructor(x = 0, y = 0, z = 0, w = 0) { 
                this.x = x; 
                this.y = y; 
                this.z = z; 
                this.w = w; 
            }
            set(vec3, w) { 
                this.x = vec3.x; 
                this.y = vec3.y; 
                this.z = vec3.z; 
                this.w = w; 
            }
        },
        vec2: (...args) => new glsl_lib.Vector2(...args),
        vec3: (...args) => new glsl_lib.Vector3(...args),
        vec4: (vec3, w) => {
            const vec4 = new glsl_lib.Vector4();
            vec4.set(vec3, w);
            return vec4;
        },
    };

    function transpileGlslToJs(glslCode) {
        return simpleGlslToJs(glslCode);
    }

    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    let compiledShader = null;

    function runSimulation(glslCode) {
        console.log('Running simulation with GLSL:', glslCode);
        compiledShader = transpileGlslToJs(glslCode);
        if (!compiledShader) {
            console.error('Shader compilation failed!');
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        console.log('Shader compiled successfully, running...');
        
        // Clear canvas first
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const uv = new glsl_lib.Vector2(x / width, (height - 1 - y) / height);
                let gl_FragColor = new glsl_lib.Vector4(0, 0, 0, 1);
                
                try {
                    compiledShader(uv, gl_FragColor, glsl_lib);
                    
                    // Debug first few pixels
                    if (x < 5 && y < 5) {
                        console.log(`Pixel (${x},${y}): uv=(${uv.x.toFixed(3)},${uv.y.toFixed(3)}), color=(${gl_FragColor.x.toFixed(3)},${gl_FragColor.y.toFixed(3)},${gl_FragColor.z.toFixed(3)})`);
                    }
                    
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex]     = Math.floor(gl_FragColor.x * 255);
                    data[pixelIndex + 1] = Math.floor(gl_FragColor.y * 255);
                    data[pixelIndex + 2] = Math.floor(gl_FragColor.z * 255);
                    data[pixelIndex + 3] = 255;
                } catch (error) {
                    console.error(`Shader execution error at pixel (${x},${y}):`, error);
                    // Set error color
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex]     = 255; // Red
                    data[pixelIndex + 1] = 0;   // Green
                    data[pixelIndex + 2] = 0;   // Blue
                    data[pixelIndex + 3] = 255; // Alpha
                }
            }
        }
        
        console.log('Putting image data to canvas...');
        ctx.putImageData(imageData, 0, 0);
        console.log('Simulation complete!');
    }

    const initialCode = [
        '// Simple gradient shader',
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
    
    // Run the first simulation.
    runSimulation(initialCode);
}