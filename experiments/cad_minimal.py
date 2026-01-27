"""
Minimal CAD viewer test - isolate the trait sync issue.
"""

import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import anywidget
    import traitlets
    return anywidget, mo, traitlets


@app.cell
def _(mo):
    mo.md("""
    # Minimal CAD Viewer Test
    """)
    return


@app.cell
def _(anywidget, traitlets):
    class MinimalViewer(anywidget.AnyWidget):
        _esm = """
        function render({ model, el }) {
            const container = document.createElement('div');
            container.style.border = '2px solid #333';
            container.style.padding = '20px';
            container.style.minHeight = '200px';
            container.style.background = '#f0f0f0';

            const status = document.createElement('div');
            status.style.marginBottom = '10px';
            container.appendChild(status);

            const content = document.createElement('div');
            content.style.fontFamily = 'monospace';
            content.style.whiteSpace = 'pre';
            container.appendChild(content);

            el.appendChild(container);

            let renderCount = 0;

            function update() {
                renderCount++;
                const data = model.get('shapes_data') || {};
                const parts = data.parts || [];

                status.innerHTML = `<b>Render #${renderCount}</b> | Parts: ${parts.length} | Time: ${new Date().toLocaleTimeString()}`;

                let html = '';
                parts.forEach((p, i) => {
                    html += `Part ${i}: ${p.name || 'unnamed'} (${p.color || 'no color'})\\n`;
                });
                content.textContent = html || '(no parts)';

                console.log('[MinimalViewer] update called, parts:', parts.length);
            }

            update();

            model.on('change:shapes_data', () => {
                console.log('[MinimalViewer] change:shapes_data received!');
                update();
            });
        }
        export default { render };
        """

        shapes_data = traitlets.Dict({}).tag(sync=True)

        def render_parts(self, parts):
            print(f"[Python] render_parts called with {len(parts)} parts")
            self.shapes_data = {"parts": parts}
    return (MinimalViewer,)


@app.cell
def _(mo):
    count_slider = mo.ui.slider(1, 6, value=3, label="Part count")
    count_slider
    return (count_slider,)


@app.cell
def _(MinimalViewer, mo):
    viewer = mo.ui.anywidget(MinimalViewer())
    return (viewer,)


@app.cell
def _(viewer):
    viewer
    return


@app.cell
def _(count_slider, viewer):
    n = count_slider.value
    parts = [{"name": f"Part-{i}", "color": f"hsl({i * 60}, 70%, 50%)"} for i in range(n)]
    viewer.widget.render_parts(parts)
    return


if __name__ == "__main__":
    app.run()
