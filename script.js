document.addEventListener('DOMContentLoaded', () => {

    let editor = null;

    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
        const initialCode = [
            '// Change the values below and see the canvas update!',
            'void main() {',
            '    vec3 color = vec3(1.0, 0.0, 1.0); // Try changing this!',
            '    gl_FragColor = vec4(color, 1.0);',
            '}'
        ].join('\n');

        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: initialCode,
            language: 'glsl',
            theme: 'vs-dark'
        });

        editor.onDidChangeModelContent(() => {
            const currentCode = editor.getValue();
            runSimulation(currentCode);
        });

        runSimulation(initialCode);
    });

    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        dot(otherVector) { return this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z; }
    }

    const canvas = document.getElementById('output-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    /**
     * OUR FIRST, SIMPLE PARSER (NOW FIXED).
     * It uses a NON-GREEDY regular expression to find the color values.
     * @param {string} glslCode The GLSL code from the editor.
     * @returns {object|null} An object {r, g, b} with values from 0-1, or null if not found.
     */
    function parseColorFromCode(glslCode) {
        // THE FIX IS HERE: We changed (.*) to (.*?) to make it non-greedy.
        const match = glslCode.match(/vec3\((.*?)\)/);

        if (match && match[1]) {
            // NEW: Log what the regex captured. This is great for debugging!
            console.log("Parser found values:", match[1]); 

            const values = match[1].split(',').map(str => parseFloat(str.trim()));
            if (values.length === 3 && !values.some(isNaN)) { // Check for 3 valid numbers
                return { r: values[0], g: values[1], b: values[2] };
            }
        }
        console.log("Parser did not find a valid vec3 color."); // Log failures too
        return null;
    }

    function runSimulation(glslCode) {
        const parsedColor = parseColorFromCode(glslCode);
        const color = parsedColor ? parsedColor : { r: 0, g: 0, b: 0 };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                data[pixelIndex]     = color.r * 255;
                data[pixelIndex + 1] = color.g * 255;
                data[pixelIndex + 2] = color.b * 255;
                data[pixelIndex + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }
});