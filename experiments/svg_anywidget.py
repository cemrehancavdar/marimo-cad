"""
Simple SVG anywidget - test Python→JS trait sync in marimo.
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
    # SVG Anywidget Test
    """)
    return


@app.cell
def _(anywidget, traitlets):
    class BarChart(anywidget.AnyWidget):
        _esm = """
        function render({ model, el }) {
            const container = document.createElement('div');
            container.style.border = '1px solid #ccc';
            container.style.padding = '10px';

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '500');
            svg.setAttribute('height', '150');
            container.appendChild(svg);

            const status = document.createElement('div');
            status.style.fontSize = '12px';
            status.style.color = '#666';
            container.appendChild(status);

            el.appendChild(container);
            
            // Track selected bar (client-side state)
            let selectedIndex = -1;

            function updateBars() {
                // Use Dict traitlet like CAD viewer does
                const data = model.get('data') || {};
                const bars = data.bars || [];
                console.log('[BarChart] updateBars called, bars:', bars.length, 'selected:', selectedIndex);
                status.textContent = `${bars.length} bars | Selected: ${selectedIndex >= 0 ? selectedIndex : 'none'} | ${new Date().toLocaleTimeString()}`;

                // Clear and redraw
                svg.innerHTML = '';

                bars.forEach((bar, i) => {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', i * 50 + 10);
                    rect.setAttribute('y', 150 - bar.height);
                    rect.setAttribute('width', '40');
                    rect.setAttribute('height', bar.height);
                    rect.setAttribute('fill', bar.color || '#4a90d9');
                    rect.style.cursor = 'pointer';
                    
                    // Highlight if selected
                    if (i === selectedIndex) {
                        rect.setAttribute('stroke', '#000');
                        rect.setAttribute('stroke-width', '3');
                    }
                    
                    // Click to select
                    rect.addEventListener('click', () => {
                        selectedIndex = (selectedIndex === i) ? -1 : i;
                        console.log('[BarChart] clicked bar', i, 'selected:', selectedIndex);
                        updateBars();
                    });
                    
                    svg.appendChild(rect);
                });
            }

            // Initial render
            updateBars();

            // Listen for changes from Python - using Dict like CAD viewer
            model.on('change:data', () => {
                console.log('[BarChart] change:data event received from Python');
                updateBars();
            });
        }
        export default { render };
        """

        # Use Dict traitlet like CAD viewer
        data = traitlets.Dict({}).tag(sync=True)

    return (BarChart,)


@app.cell
def _(mo):
    count_slider = mo.ui.slider(1, 10, value=5, label="Bars")
    max_height = mo.ui.slider(20, 120, value=80, label="Max Height")
    mo.hstack([count_slider, max_height])
    return count_slider, max_height


@app.cell
def _(BarChart, mo):
    # Try with mo.ui.anywidget wrapper (like we did with CAD viewer)
    chart = mo.ui.anywidget(BarChart())
    return (chart,)


@app.cell
def _(chart):
    chart
    return


@app.cell
def _(chart, count_slider, max_height):
    import random

    random.seed(42)

    n = count_slider.value
    h = max_height.value

    new_bars = [
        {"height": random.randint(20, h), "color": f"hsl({i * 360 // n}, 70%, 50%)"}
        for i in range(n)
    ]

    print(f"[Python] Setting {len(new_bars)} bars via Dict traitlet")
    # Use Dict traitlet like CAD viewer does
    chart.widget.data = {"bars": new_bars}
    return


if __name__ == "__main__":
    app.run()
