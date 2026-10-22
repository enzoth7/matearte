import unittest

from agenda_import import category_for, normalize_phone, reconcile_existing


class AgendaImportTests(unittest.TestCase):
    def test_country_codes_and_argentine_mobile(self):
        self.assertEqual(normalize_phone("59899123456"), ("+59899123456", "Uruguay"))
        self.assertEqual(normalize_phone("0059899123456"), ("+59899123456", "Uruguay"))
        self.assertEqual(normalize_phone("541134567890"), ("+5491134567890", "Argentina"))
        self.assertEqual(normalize_phone("*611"), (None, None))

    def test_category_only_when_unambiguous(self):
        self.assertEqual(category_for("Enzo Imperial"), "Mates")
        self.assertEqual(category_for("Ana Bombilla"), "Bombillas")
        self.assertIsNone(category_for("Mate y bombilla"))
        self.assertIsNone(category_for("Enzo Pérez"))

    def test_existing_conflict_is_not_auto_merged(self):
        incoming = [{"phone": "+59899123456", "agenda_additional_phones": [], "email": None,
                     "full_name": "Otra persona", "source_rows": [6]}]
        existing = [{"id": "old-1", "phone": "099123456", "email": None, "full_name": "Persona original"}]
        accepted, review = reconcile_existing(incoming, [], existing)
        self.assertEqual(accepted, [])
        self.assertEqual(len(review), 1)
        self.assertEqual(review[0]["existing_id"], "old-1")


if __name__ == "__main__":
    unittest.main()
