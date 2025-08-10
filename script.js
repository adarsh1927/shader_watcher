// Wait for the browser to load the HTML before running any code
document.addEventListener('DOMContentLoaded', () => {

    let editor = null; // We'll store the editor instance here

    // --- 1. MONACO EDITOR SETUP ---
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
        // Initial GLSL code for the editor
        const initialCode = [
            '// Change the values below and see the canvas update!',
            'void main() {',
            '    vec3 color = vec3(1.0, 0.0, 1.0); // Try (0.0, 1.0, 0.5)',
            '    gl_FragColor = vec4(color, 1.0);',
            '}'
        ].join('\n');

        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: initialCode,
            language: 'glsl',
            theme: 'vs-dark'
        });

        // Listen for any changes in the editor's content
        editor.onDidChangeModelContent(() => {
            // When a change is detected, get the new code and run the simulation
            const currentCode = editor.getValue();
            runSimulation(currentCode);
        });

        // Run the simulation once at the start with the initial code
        runSimulation(initialCode);
    });

    // --- 2. JAVASCRIPT "GLSL" LIBRARY (Your custom math classes) ---
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        dot(otherVector) {
            return this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z;
        }
    }

    // --- 3. THE SIMULATOR CORE ---
    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    /**
     * OUR FIRST, SIMPLE PARSER.
     * It uses a regular expression to find the first line containing 'vec3(...)'.
     * It extracts the number values from inside the parentheses.
     * @param {string} glslCode The GLSL code from the editor.
     * @returns {object|null} An object {r, g, b} with values from 0-1, or null if not found.
     */
    function parseColorFromCode(glslCode) {
        // This regex looks for the string "vec3(" followed by any characters captured in a group (.*?), and then a closing parenthesis ")".
        const match = glslCode.match(/vec3\((.*)\)/);
        if (match && match[1]) {
            const values = match[1].split(',').map(Number); // Split "1.0, 0.0, 1.0" into an array [1.0, 0.0, 1.0]
            if (values.length === 3) {
                return { r: values[0], g: values[1], b: values[2] };
            }
        }
        return null; // Return null if the pattern wasn't found
    }

    /**
     * The main simulation function. It now takes the GLSL code as an argument.
     * @param {string} glslCode The code currently in the editor.
     */
    function runSimulation(glslCode) {
        // Use our simple parser to get the color
        const parsedColor = parseColorFromCode(glslCode);
        
        // If the parser fails, default to black so we know there's an error.
        const color = parsedColor ? parsedColor : { r: 0, g: 0, b: 0 };

        // The main simulation loop - runs once for every single pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate the index in the flat 'data' array for the current pixel
                const pixelIndex = (y * width + x) * 4;

                // Set the pixel data. We multiply by 255 to convert from 0.0-1.0 range to 0-255 range.
                data[pixelIndex]     = color.r * 255; // Red
                data[pixelIndex + 1] = color.g * 255; // Green
                data[pixelIndex + 2] = color.b * 255; // Blue
                data[pixelIndex + 3] = 255;           // Alpha
            }
        }

        // After the loop, draw the result to the canvas
        ctx.putImageData(imageData, 0, 0);
    }
});