"""Generate favicon PNG/ICO assets from the site logo mark."""
from PIL import Image, ImageDraw

BG = (20, 21, 26, 255)
ORANGE = (255, 90, 31, 255)
# Barbell geometry on a 64x64 grid (matches favicon.svg)
SHAPES = [(9.6, 23.6, 16.6, 40.4), (47.4, 23.6, 54.4, 40.4), (16.6, 29.2, 47.4, 34.8)]


def render(size, radius_ratio=0.22, ss=8):
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = s * radius_ratio
    if r > 0:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=BG)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=BG)
    k = s / 64
    for x0, y0, x1, y1 in SHAPES:
        d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], fill=ORANGE)
    return img.resize((size, size), Image.LANCZOS)


render(32).save("favicon-32x32.png")
render(16).save("favicon-16x16.png")
render(180, radius_ratio=0).save("apple-touch-icon.png")
render(192).save("icon-192.png")
render(512).save("icon-512.png")
render(64).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("done")
