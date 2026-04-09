"""
Fetch real author photos from Wikipedia and generate TTS audio voice cards.
"""
import asyncio
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import yaml

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTHORS_DIR = os.path.join(BASE_DIR, "src", "content", "authors")
IMAGES_DIR = os.path.join(BASE_DIR, "public", "images", "authors")
AUDIO_DIR = os.path.join(BASE_DIR, "public", "audio")

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

# Wikipedia name mapping (slug -> Wikipedia article title)
WIKI_NAMES = {
    "pessoa": "Fernando Pessoa",
    "kafka": "Franz Kafka",
    "shi-tiesheng": "Shi Tiesheng",
    "wang-shuo": "Wang Shuo",
    "nashiki-kaho": "Nahoko Uehashi",  # Actually 梨木香步 = Nashiki Kaho
    "hermann-hesse": "Hermann Hesse",
    "yiman": None,  # Not well-known enough for Wikipedia
    "andres-barba": "Andrés Barba",
    "linnea-sterte": None,  # Swedish comic artist, may not have Wikipedia photo
    "haruki-murakami": "Haruki Murakami",
    "gabriel-garcia-marquez": "Gabriel García Márquez",
    "virginia-woolf": "Virginia Woolf",
    "jorge-luis-borges": "Jorge Luis Borges",
    "italo-calvino": "Italo Calvino",
    "milan-kundera": "Milan Kundera",
    "rainer-maria-rilke": "Rainer Maria Rilke",
    "albert-camus": "Albert Camus",
    "lu-xun": "Lu Xun",
    "natsume-soseki": "Natsume Sōseki",
    "wislawa-szymborska": "Wisława Szymborska",
    "marcel-proust": "Marcel Proust",
    "fyodor-dostoevsky": "Fyodor Dostoevsky",
    "emily-dickinson": "Emily Dickinson",
    "oscar-wilde": "Oscar Wilde",
    "yukio-mishima": "Yukio Mishima",
    "sylvia-plath": "Sylvia Plath",
    "marguerite-duras": "Marguerite Duras",
    "roberto-bolano": "Roberto Bolaño",
    "toni-morrison": "Toni Morrison",
    "cesare-pavese": "Cesare Pavese",
    "clarice-lispector": "Clarice Lispector",
    "yu-hua": "Yu Hua",
    "murasaki-shikibu": "Murasaki Shikibu",
    "pablo-neruda": "Pablo Neruda",
    "shen-congwen": "Shen Congwen",
    "anton-chekhov": "Anton Chekhov",
    "james-joyce": "James Joyce",
    "banana-yoshimoto": "Banana Yoshimoto",
    "olga-tokarczuk": "Olga Tokarczuk",
    "han-kang": "Han Kang",
    "orhan-pamuk": "Orhan Pamuk",
    "cao-xueqin": "Cao Xueqin",
    "william-shakespeare": "William Shakespeare",
    "li-bai": "Li Bai",
    "dante-alighieri": "Dante Alighieri",
    "homer": "Homer",
    "rabindranath-tagore": "Rabindranath Tagore",
    "octavio-paz": "Octavio Paz",
    "zhang-ailing": "Eileen Chang",
    "haruki-ogawa": "Yōko Ogawa",
    "elena-ferrante": "Elena Ferrante",
    "wang-xiaobo": "Wang Xiaobo",
    "julio-cortazar": "Julio Cortázar",
    "simone-de-beauvoir": "Simone de Beauvoir",
    "alejandra-pizarnik": "Alejandra Pizarnik",
}


def parse_frontmatter(filepath):
    """Parse YAML frontmatter from a markdown file."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return None
    return yaml.safe_load(match.group(1))


def fetch_wikipedia_image(title):
    """Fetch the main image URL from Wikipedia REST API (use thumbnail to avoid 429)."""
    encoded = urllib.parse.quote(title)
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "LesleyLiteraryProject/1.0 (educational; birthday gift; contact: lesley@example.com)"
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        # Use thumbnail (smaller, less likely to 429) then fall back to original
        if "thumbnail" in data:
            return data["thumbnail"]["source"]
        if "originalimage" in data:
            return data["originalimage"]["source"]
    except Exception as e:
        print(f"  [WARN] Wikipedia API error for '{title}': {e}")
    return None


def download_image(url, filepath):
    """Download an image from URL to filepath."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LesleyLiterary/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"  [WARN] Download error: {e}")
        return False


def get_extension(url):
    """Get file extension from URL."""
    path = urllib.parse.urlparse(url).path.lower()
    for ext in [".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"]:
        if path.endswith(ext):
            return ext
    return ".jpg"


async def generate_tts(text, output_path, voice="zh-CN-XiaoxiaoNeural"):
    """Generate TTS audio using edge-tts."""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)


async def main():
    # Collect all authors
    authors = []
    for filename in sorted(os.listdir(AUTHORS_DIR)):
        if not filename.endswith(".md"):
            continue
        slug = filename[:-3]
        filepath = os.path.join(AUTHORS_DIR, filename)
        fm = parse_frontmatter(filepath)
        if fm:
            authors.append({"slug": slug, "frontmatter": fm, "filepath": filepath})

    print(f"Found {len(authors)} authors\n")

    # --- PHASE 1: Download Wikipedia photos ---
    print("=" * 50)
    print("PHASE 1: Downloading Wikipedia photos")
    print("=" * 50)

    photo_results = {"success": 0, "skip": 0, "fail": 0}
    for author in authors:
        slug = author["slug"]
        wiki_name = WIKI_NAMES.get(slug)

        # Check if we already have a non-SVG image
        existing = None
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            candidate = os.path.join(IMAGES_DIR, f"{slug}{ext}")
            if os.path.exists(candidate) and os.path.getsize(candidate) > 1000:
                existing = candidate
                break

        if existing:
            print(f"[SKIP] {slug} - already has photo")
            photo_results["skip"] += 1
            continue

        if not wiki_name:
            print(f"[SKIP] {slug} - no Wikipedia mapping")
            photo_results["skip"] += 1
            continue

        print(f"[FETCH] {slug} ({wiki_name})...", end=" ", flush=True)
        time.sleep(2)  # Rate limit: 2s between requests
        img_url = fetch_wikipedia_image(wiki_name)
        if not img_url:
            print("no image found")
            photo_results["fail"] += 1
            continue

        ext = get_extension(img_url)
        out_path = os.path.join(IMAGES_DIR, f"{slug}{ext}")
        if download_image(img_url, out_path):
            size_kb = os.path.getsize(out_path) / 1024
            print(f"OK ({size_kb:.0f}KB)")
            photo_results["success"] += 1
        else:
            photo_results["fail"] += 1

    print(f"\nPhotos: {photo_results['success']} downloaded, {photo_results['skip']} skipped, {photo_results['fail']} failed\n")

    # --- PHASE 2: Generate TTS audio ---
    print("=" * 50)
    print("PHASE 2: Generating TTS voice cards")
    print("=" * 50)

    audio_results = {"success": 0, "skip": 0, "fail": 0}
    for author in authors:
        slug = author["slug"]
        fm = author["frontmatter"]
        audio_config = fm.get("audio")

        if not audio_config:
            print(f"[SKIP] {slug} - no audio config")
            audio_results["skip"] += 1
            continue

        out_path = os.path.join(AUDIO_DIR, f"{slug}.mp3")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            print(f"[SKIP] {slug} - already has audio")
            audio_results["skip"] += 1
            continue

        quote = audio_config.get("quote", {})
        text = quote.get("zh", "")
        if not text:
            print(f"[SKIP] {slug} - no quote text")
            audio_results["skip"] += 1
            continue

        # Choose voice based on language
        original = quote.get("original", "")
        # Use Chinese voice for Chinese quotes
        voice = "zh-CN-YunxiNeural"  # Male voice, warm tone

        print(f"[TTS] {slug}: \"{text[:30]}...\"", end=" ")
        try:
            await generate_tts(text, out_path, voice)
            size_kb = os.path.getsize(out_path) / 1024
            print(f"OK ({size_kb:.0f}KB)")
            audio_results["success"] += 1
        except Exception as e:
            print(f"FAIL: {e}")
            audio_results["fail"] += 1

    print(f"\nAudio: {audio_results['success']} generated, {audio_results['skip']} skipped, {audio_results['fail']} failed")

    # --- PHASE 3: Update frontmatter portrait paths ---
    print("\n" + "=" * 50)
    print("PHASE 3: Updating portrait paths in frontmatter")
    print("=" * 50)

    updated = 0
    for author in authors:
        slug = author["slug"]
        filepath = author["filepath"]

        # Find the actual image file
        actual_ext = None
        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            if os.path.exists(os.path.join(IMAGES_DIR, f"{slug}{ext}")):
                actual_ext = ext
                break

        if not actual_ext:
            continue  # Keep existing SVG or whatever

        new_portrait = f"/images/authors/{slug}{actual_ext}"
        old_portrait = author["frontmatter"].get("portrait", "")

        if old_portrait == new_portrait:
            continue

        # Update the file
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Replace portrait line
        old_line = f'portrait: "{old_portrait}"'
        new_line = f'portrait: "{new_portrait}"'
        if old_line in content:
            content = content.replace(old_line, new_line)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"[UPDATE] {slug}: {old_portrait} -> {new_portrait}")
            updated += 1

    print(f"\nUpdated {updated} portrait paths")
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
