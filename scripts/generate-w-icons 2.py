from PIL import Image
from pathlib import Path

src = Path(r"C:\Users\Magshimim\Desktop\wineries app new\wineries-app\public\logo-main.png")
if not src.exists():
    raise SystemExit(f"Missing: {src}")

img = Image.open(src).convert("RGBA")
px = img.load()
width, height = img.size

# Identify non-white columns
col_has = [False] * width
for x in range(width):
    for y in range(height):
        r, g, b, a = px[x, y]
        if a > 0 and not (r > 245 and g > 245 and b > 245):
            col_has[x] = True
            break

# Find continuous segments of non-white pixels (letters)
segments = []
start = None
for x, has in enumerate(col_has):
    if has and start is None:
        start = x
    if start is not None and (not has or x == width - 1):
        end = x if not has else x
        segments.append((start, end))
        start = None

if not segments:
    raise SystemExit("No non-white pixels found in logo.")

# Take the first segment as the stylized W
w_start, w_end = segments[0]
# Add a small padding around the W segment
pad = int(height * 0.05)
left = max(0, w_start - pad)
right = min(width, w_end + pad)

# Find vertical bounds within this segment
min_y = height
max_y = 0
for x in range(left, right):
    for y in range(height):
        r, g, b, a = px[x, y]
        if a > 0 and not (r > 245 and g > 245 and b > 245):
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y

if min_y >= max_y:
    min_y, max_y = 0, height - 1

w_crop = img.crop((left, min_y, right, max_y + 1))

# Remove white background from the crop
w_crop = w_crop.copy()
cp = w_crop.load()
cw, ch = w_crop.size
for x in range(cw):
    for y in range(ch):
        r, g, b, a = cp[x, y]
        if r > 245 and g > 245 and b > 245:
            cp[x, y] = (r, g, b, 0)

# Create icon with padding

def render_icon(size, padding_ratio=0.18, background=(255, 255, 255, 255)):
    canvas = Image.new("RGBA", (size, size), background)
    target = size - int(size * padding_ratio * 2)
    # Fit W into target
    w = w_crop.copy()
    w.thumbnail((target, target), Image.LANCZOS)
    x = (size - w.size[0]) // 2
    y = (size - w.size[1]) // 2
    canvas.alpha_composite(w, (x, y))
    return canvas

out_dir = Path(r"C:\Users\Magshimim\Desktop\wineries app new\wineries-app\public")

# Standard icons
icon_192 = render_icon(192, padding_ratio=0.18)
icon_512 = render_icon(512, padding_ratio=0.18)

# Maskable icons (more padding, solid background)
mask_192 = render_icon(192, padding_ratio=0.26)
mask_512 = render_icon(512, padding_ratio=0.26)

# Apple touch icon
apple_180 = render_icon(180, padding_ratio=0.18)

icon_192.save(out_dir / "app-icon-192.png")
icon_512.save(out_dir / "app-icon-512.png")
mask_192.save(out_dir / "app-icon-192-maskable.png")
mask_512.save(out_dir / "app-icon-512-maskable.png")
apple_180.save(out_dir / "apple-touch-icon.png")

print("Generated W icons in public/")
