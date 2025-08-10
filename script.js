// Wait for the browser to load the HTML before running any code
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. MONACO EDITOR SETUP ---
    // Monaco is loaded via a script tag, so we use its 'require' syntax
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
        const editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: [
                '// Welcome to your GLSL Simulator!',
                '// This code is not yet connected, but the editor is working.',
                '// You can type GLSL code here.',
                'void main() {',
                '    vec3 color = vec3(1.0, 0.0, 1.0); // Magenta',
                '    gl_FragColor = vec4(color, 1.0);',
                '}'
            ].join('\n'),
            language: 'glsl',
            theme: 'vs-dark' // A nice dark theme
        });
    });

    // --- 2. JAVASCRIPT "GLSL" LIBRARY (Your custom math classes) ---
    // This is the beginning of your library that will replicate GLSL functions.
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        // Example method: dot product
        dot(otherVector) {
            return this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z;
        }
    }

    // Example of using our new class. Check the browser's console (F12) to see the output.
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(4, 5, 6);
    console.log("Dot product of v1 and v2 is:", v1.dot(v2)); // Expected: 4 + 10 + 18 = 32

    // --- 3. THE SIMULATOR CORE ---
    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Get a handle to the raw pixel data of the canvas. This is much faster
    // than drawing one pixel at a time with ctx.fillRect().
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data; // This is a flat array of [R, G, B, A, R, G, B, A, ...] values.

    console.log(`Starting simulation for a ${width}x${height} canvas...`);

    // The main simulation loop. This acts like a fragment shader.
    // It runs once for every single pixel.
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            
            // --- This is where the magic happens ---
            // For now, we will just output a single, hard-coded color.
            // In the future, we will run the transpiled GLSL code here.

            const color = { r: 255, g: 0, b: 255 }; // Hard-coded Magenta

            // Calculate the index in the flat 'data' array for the current pixel
            const pixelIndex = (y * width + x) * 4; // 4 because each pixel has R,G,B,A components

            // Set the pixel data
            data[pixelIndex]     = color.r; // Red
            data[pixelIndex + 1] = color.g; // Green
            data[pixelIndex + 2] = color.b; // Blue
            data[pixelIndex + 3] = 255;      // Alpha (fully opaque)
        }
    }

    // --- 4. RENDER THE RESULT ---
    // After the loop has filled the imageData array, we draw it to the canvas in one go.
    ctx.putImageData(imageData, 0, 0);

    console.log("Simulation complete. Canvas has been rendered.");
});