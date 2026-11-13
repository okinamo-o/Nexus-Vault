import sys
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
import main as scraper  # noqa: E402


class ScraperUnitTests(unittest.TestCase):
    def test_slugify_transliterates_unicode_to_ascii(self) -> None:
        self.assertEqual(
            scraper.slugify("God of War Ragnarök Digital Deluxe Edition"),
            "god-of-war-ragnarok-digital-deluxe-edition",
        )
        self.assertEqual(scraper.slugify("Pokémon: Scarlet/Violet – Double Pack"), "pokemon-scarletviolet-double-pack")
        self.assertEqual(scraper.slugify("UMIGARI | ウミガリ"), "umigari")

    def test_sanitize_text_unescapes_html_and_strips_intro_boilerplate(self) -> None:
        raw = (
            "Get Sniper Elite 4 for free instantly and play pre-installed on SteamRIP "
            "Discover unrivalled sniping &amp; tactical combat."
        )
        cleaned = scraper.sanitize_text(raw)
        self.assertEqual(cleaned, "Discover unrivalled sniping & tactical combat.")

    def test_sanitize_text_preserves_multi_sentence_descriptions(self) -> None:
        raw = (
            "Will You Snail? Directly Download "
            "Fast paced precision platforming. AI spawned traps. "
            "Later enjoy a free download of bonus OST tracks."
        )
        cleaned = scraper.sanitize_text(raw, title="Will You Snail?")
        self.assertTrue(cleaned.startswith("Fast paced precision platforming."))
        self.assertIn("bonus OST tracks.", cleaned)

        no_title_prefix = (
            "Fast paced precision platforming. AI spawned traps. "
            "Later enjoy a free download of bonus OST tracks."
        )
        self.assertEqual(scraper.sanitize_text(no_title_prefix), no_title_prefix)

    def test_is_invalid_scraped_page_blocks_cloudflare_and_error_pages(self) -> None:
        self.assertIsNotNone(scraper.is_invalid_scraped_page("steamrip.com", "steamrip.com", 0))
        self.assertIsNotNone(scraper.is_invalid_scraped_page("Just a moment...", "Checking...", 0))
        self.assertIsNotNone(
            scraper.is_invalid_scraped_page("Internal server error Error code 500", "Error", 0)
        )
        self.assertIsNone(
            scraper.is_invalid_scraped_page("tERRORbane", "A comedic RPG full of bugs and glitches.", 2)
        )

    def test_extract_candidate_links_skips_screenshot_anchors_and_non_hosts(self) -> None:
        html = """
        <article id="the-post">
          <div class="entry-content">
            <a href="https://images.steamusercontent.com/ugc/123/abc/">
              <img src="thumb.jpg" />
            </a>
            <a href="https://images.steamusercontent.com/ugc/999/def/">Screenshot</a>
            <a href="https://github.com/example/repo">Repo</a>
            <a href="https://steamrip.com/go/megadb-123/">MegaDB</a>
            <a href="https://gofile.io/d/xyz789?utm_source=test">Gofile</a>
          </div>
        </article>
        """
        soup = BeautifulSoup(html, "html.parser")
        links = scraper.extract_candidate_links(soup, "https://steamrip.com/test-game-free-download/")
        self.assertEqual(
            links,
            [
                "https://steamrip.com/go/megadb-123/",
                "https://gofile.io/d/xyz789",
            ],
        )

    def test_normalize_game_urls_preserves_chronological_order_and_dedupes(self) -> None:
        hrefs = [
            "https://steamrip.com/newest-drop-free-download/",
            "https://steamrip.com/category/action/",
            "/second-drop-free-download",
            "https://steamrip.com/newest-drop-free-download/",
            "https://otherdomain.com/bad-free-download/",
        ]
        urls = scraper.normalize_game_urls(hrefs, "https://steamrip.com/")
        self.assertEqual(
            urls,
            [
                "https://steamrip.com/newest-drop-free-download/",
                "https://steamrip.com/second-drop-free-download/",
            ],
        )


if __name__ == "__main__":
    unittest.main()
