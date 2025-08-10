document.addEventListener('DOMContentLoaded', () => {

    let editor = null;

    // --- UTILITY FUNCTION: DEBOUNCE ---
    // This function prevents another function from being called too frequently.
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- JAVASCRIPT "GLSL" LIBRARY ---
    class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
    class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }
    class Vector4 {
        constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; }
        set(vec3, w) { this.x = vec3.x; this.y = vec3.y; this.z = vec3.z; this.w = w; }
    }

    // --- EDITOR SETUP ---
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
        const initialCode = [
            '// Your code runs for every pixel!',
            '// The `uv` variable holds the coordinates (0.0 to 1.0).',
            '',
            'let color = new Vector3(uv.x, uv.y, 0.5);',
            '',
            '// This is our output variable.',
            'gl_FragColor.set(color, 1.0);'
        ].join('\n');

        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: initialCode,
            language: 'javascript',
            theme: 'vs-dark'
        });

        // --- THE FIX IS HERE! ---
        // We wrap our call to runSimulation in our new debounce function.
        // The simulation will now only run 250ms *after* the user stops typing.
        editor.onDidChangeModelContent(debounce(() => {
            runSimulation(editor.getValue());
        }, 250));

        runSimulation(initialCode);
    });

    // --- THE SIMULATOR CORE (Unchanged) ---
    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    function runSimulation(userCode) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const uv = new Vector2(x / width, (height - 1 - y) / height);
                let gl_FragColor = new Vector4(0, 0, 0, 1);
                try {
                    eval(userCode);
                } catch (error) {
                    gl_FragColor = new Vector4(1, 0, 0, 1);
                }
                const pixelIndex = (y * width + x) * 4;
                data[pixelIndex]     = gl_FragColor.x * 255;
                data[pixelIndex + 1] = gl_FragColor.y * 255;
                data[pixelIndex + 2] = gl_FragColor.z * 255;
                data[pixelIndex + 3] = gl_FragColor.w * 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
});