"""Generate the original Relay sample, assets and brief for the Studio Cut factory."""
import argparse
import json
import math
from array import array
from pathlib import Path
import subprocess
import wave

from PIL import Image, ImageDraw, ImageFont

SIZE = (720, 900)
FPS = 30
EVENT = 42
SECONDS = 12
RATE = 48000
STOPS = (("North dock", 1.2), ("River lab", 2.7), ("West depot", 1.5))
BG, PANEL, INK, MUTED, MINT = "#101c2c", "#1a2b40", "#eef5ff", "#acc0d5", "#80ead2"
FONT_ROOT = Path("C:/Windows/Fonts")
FONTS = {}

def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(str(FONT_ROOT / ("arialbd.ttf" if bold else "arial.ttf")), size)
    return FONTS[key]

def text(draw, x, y, label, size=28, color=INK, bold=False):
    draw.text((x, y), label, fill=color, font=font(size, bold))

def route_screen(view, assigned=False):
    screen = Image.new("RGB", SIZE, BG)
    draw = ImageDraw.Draw(screen)
    draw.rounded_rectangle((33, 39, 84, 90), 13, fill=MINT)
    draw.line([(47, 70), (57, 70), (67, 56), (74, 56)], fill=BG, width=5)
    text(draw, 102, 43, "Relay", 37, bold=True)
    text(draw, 516, 58, "DEMO ROUTES", 18, color=MUTED, bold=True)
    text(draw, 35, 121, {"map":"River route", "stops":"Delivery stops", "assign":"Route assignment"}[view], 55, bold=True)
    text(draw, 38, 195, "LOCAL WORKSPACE", 22, color=MINT, bold=True)
    if view == "map":
        draw.rounded_rectangle((33, 248, 686, 725), 27, fill=PANEL)
        for x in range(66, 671, 58):
            draw.line((x, 270, x, 702), fill="#263a50", width=2)
        for y in range(277, 705, 53):
            draw.line((51, y, 669, y), fill="#263a50", width=2)
        for y in range(278, 708, 8):
            x = 450 + 51 * math.cos(y / 126)
            draw.line((x, y, x + 83, y + 5), fill="#233e63", width=9)
        points=[(135, 583), (213, 583), (213, 448), (343, 448), (343, 366), (540, 366)]
        draw.line(points, fill="#124850", width=26, joint="curve")
        draw.line(points, fill=MINT, width=9, joint="curve")
        for number, (x,y) in enumerate((points[0],points[3],points[-1]), 1):
            draw.ellipse((x-18,y-18,x+18,y+18),fill=MINT,outline=BG,width=3)
            text(draw,x-6,y-12,str(number),21,BG,True)
        text(draw, 42, 775, "3 STOPS", 25, MINT, True)
        text(draw, 528, 771, "5.4 km", 37, bold=True)
    elif view == "stops":
        for index, (stop, distance) in enumerate(STOPS, 1):
            y = 248 + (index - 1) * 164
            draw.rounded_rectangle((33, y, 686, y + 137), 24, fill=PANEL)
            draw.ellipse((61, y+34, 119, y+92), fill="#22534f")
            text(draw, 80, y + 47, str(index), 28, MINT, True)
            text(draw, 143, y + 37, stop, 37, bold=True)
            text(draw, 145, y + 87, "Scheduled stop", 24, color=MUTED)
            text(draw, 545, y + 53, f"{distance:.1f} km", 30)
        text(draw, 38, 787, "NORTH TO WEST", 22, MINT, True)
    else:
        draw.rounded_rectangle((33, 248, 686, 621), 28, fill=PANEL)
        text(draw, 68, 283, "RIVER ROUTE", 24, MINT, True)
        text(draw, 68, 344, "Dispatch team", 41, bold=True)
        text(draw, 70, 407, "Local team · 3 stops", 26, color=MUTED)
        draw.line((69, 476, 649, 476), fill="#3d5063", width=2)
        text(draw, 69, 510, "Assigned" if assigned else "Awaiting assignment", 38, MINT if assigned else INK, True)
        draw.rounded_rectangle((34, 674, 686, 791), 24, fill="#254f50" if assigned else MINT)
        text(draw, 75, 708, "Route assigned" if assigned else "Assign route", 40, MINT if assigned else BG, True)
        text(draw, 76, 828, "Saved in this demo workspace" if assigned else "Ready to send to the dispatch team", 23, MUTED)
    return screen

def write_wave(path, samples):
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        output.writeframes(samples.tobytes())

def synthesize(audio):
    chord = (110, 164.81, 220, 261.63)
    def bed(t):
        fade = min(1, t / 0.18, (SECONDS - t) / 0.35)
        return 0.052 * fade * sum(math.sin(2 * math.pi * f * t) * (0.36 - 0.05 * i)
                                  for i, f in enumerate(chord))
    write_wave(audio / "bed.wav", array("h", (round(32767 * bed(i / RATE)) for i in range(SECONDS * RATE))))
    def confirmation(t):
        return 0.31 * (1 - math.exp(-480 * t)) * math.exp(-11 * t) * (
            0.70 * math.sin(2 * math.pi * 784 * t) + 0.30 * math.sin(2 * math.pi * 1174.66 * t))
    write_wave(audio / "confirm.wav", array("h", (round(32767 * confirmation(i / RATE)) for i in range(RATE // 2))))

def brief():
    return {
      "schemaVersion": "2", "id": "relay-demo", "brand": {"name": "Relay", "color": "#80ead2"},
      "durationSeconds": SECONDS, "fps": FPS, "aspectRatios": ["9:16", "16:9", "1:1"],
      "hook": "A route in view.", "hero": "map.png", "cta": "Plan a route",
      "features": [
        {"title": "Three clear stops.", "body": "See the order before you leave.", "asset": "stops.png"},
        {"title": "Assign the route.", "body": "Send it to the dispatch team.", "asset": "assign.mp4",
         "result": {"sourceFrame": EVENT, "title": "Route assigned.", "body": "All three stops go with it."}},
      ],
      "renderRights": {"origin": "synthetic", "approved": True, "license": "Original project-authored demo",
                       "privacy": "Synthetic routes and names, no personal data"},
      "editorial": {"template": "studio-cut-v2", "motion": "expressive", "artDirection": "obsidian",
        "productLabel": "ROUTE PLANNING",
        "proposition": {"title": "See the whole route.", "body": "One view for the whole team.", "asset":"route.png"},
        "closingStatement": "Ready to roll.", "closingLine": "Routes for teams on the move.",
        "logo": "mark.png", "audio": {"file":"bed.wav", "license":"Original synthesized composition",
          "cues":[{"file":"confirm.wav","license":"Original synthesized sound","atShot":"feature-2","offsetFrames":EVENT,"gainDb":-1}]},
        "direction": {"feature-2":{"taps":[{"at":0.4494,"x":0.36,"y":0.81}],
          "emphasis":[{"from":0.50,"until":0.93,"region":{"x":0.10,"y":0.56,"width":0.67,"height":0.094}}]}},
      },
    }

def main():
    global FONT_ROOT
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--font-directory", type=Path, default=FONT_ROOT)
    args = parser.parse_args()
    FONT_ROOT = args.font_directory
    root = args.directory
    screens, logo, audio = (root / "assets" / name for name in ("screenshots","logo","audio"))
    for folder in (screens, logo, audio):
        folder.mkdir(parents=True, exist_ok=True)
    route_screen("map").save(screens / "map.png")
    route = route_screen("map")
    draw = ImageDraw.Draw(route)
    draw.rounded_rectangle((392, 646, 649, 706), 18, fill="#0f2935", outline=MINT, width=2)
    text(draw, 412, 663, "ROUTE READY", 24, MINT, True)
    route.save(screens / "route.png")
    route_screen("stops").save(screens / "stops.png")
    mark = Image.new("RGBA", (420, 420))
    draw = ImageDraw.Draw(mark)
    draw.rounded_rectangle((35,35,385,385), 83, fill=BG)
    draw.line([(100,260),(159,260),(250,157),(316,157)], fill=MINT, width=26, joint="curve")
    draw.ellipse((302,143,330,171), fill=MINT)
    mark.save(logo / "mark.png")
    before, after = (route_screen("assign", assigned).tobytes() for assigned in (False,True))
    with subprocess.Popen([
        "ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-pixel_format","rgb24",
        "-video_size","720x900","-framerate",str(FPS),"-i","-","-an","-c:v","libx264",
        "-pix_fmt","yuv420p","-crf","17","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709",
        str(screens / "assign.mp4"),
    ], stdin=subprocess.PIPE) as video:
        assert video.stdin is not None
        for frame in range(96):
            video.stdin.write(after if frame >= EVENT else before)
        video.stdin.close()
        if video.wait():
            raise RuntimeError("Failed to encode sample recording")
    synthesize(audio)
    data = brief()
    (root / "brief.json").write_text(json.dumps(data,indent=2)+"\n", encoding="utf-8")
    del data["editorial"]["artDirection"]
    (root / "baseline-brief.json").write_text(json.dumps(data,indent=2)+"\n", encoding="utf-8")

if __name__ == "__main__":
    main()
