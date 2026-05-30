# -*- coding: utf-8 -*-
"""Golden-style checks for notification report formatting fixtures."""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.formatters import (
    chunk_markdown_preserving_blocks,
    format_feishu_markdown,
    format_slack_mrkdwn,
    format_telegram_markdown,
    format_wechat_markdown,
    utf16_len,
    utf8_len,
)


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "notification_reports"


class NotificationReportFixtureTestCase(unittest.TestCase):
    def test_all_report_fixtures_exist(self):
        expected = {
            "aggregate_report.md",
            "single_stock_report.md",
            "market_review_report.md",
        }

        self.assertEqual(expected, {path.name for path in FIXTURE_DIR.glob("*.md")})

    def test_chat_formatters_keep_core_sections_and_drop_pipe_tables(self):
        for path in FIXTURE_DIR.glob("*.md"):
            content = path.read_text(encoding="utf-8")

            for formatted in (
                format_feishu_markdown(content),
                format_wechat_markdown(content),
                format_telegram_markdown(content),
                format_slack_mrkdwn(content),
            ):
                self.assertIn("##", content)
                self.assertNotIn("| --- |", formatted)
                self.assertTrue("风险" in formatted or "操作" in formatted or "观察" in formatted)

    def test_fixture_chunking_preserves_markdown_boundaries(self):
        content = (FIXTURE_DIR / "aggregate_report.md").read_text(encoding="utf-8")

        for chunks in (
            chunk_markdown_preserving_blocks(content, 220),
            chunk_markdown_preserving_blocks(content, 360, len_fn=utf8_len),
            chunk_markdown_preserving_blocks(content, 220, len_fn=utf16_len),
        ):
            self.assertGreater(len(chunks), 1)
            for chunk in chunks:
                self.assertEqual(chunk.count("```") % 2, 0)


if __name__ == "__main__":
    unittest.main()
