import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import VoiceDesk as app


class SrtTests(unittest.TestCase):
    def row(self, time, speaker='화자 1', text='안녕하세요'):
        return app.RowItem('sample.wav', time, speaker, text, '')

    def test_overlap_preserves_each_boundary_and_speaker(self):
        rows = [self.row('00:01.200 - 00:03.400'),
                self.row('00:02.000 - 00:04.500', '화자 2', '네')]
        self.assertEqual(app.render_srt(rows),
                         '1\n00:00:01,200 --> 00:00:02,000\n[화자 1] 안녕하세요\n\n'
                         '2\n00:00:02,000 --> 00:00:03,400\n[화자 1] 안녕하세요\n[화자 2] 네\n\n'
                         '3\n00:00:03,400 --> 00:00:04,500\n[화자 2] 네\n\n')

    def test_time_formats(self):
        self.assertEqual(app.parse_timestamp('01:02:03,045'), 3723045)
        self.assertEqual(app.parse_timestamp('02:03.4'), 123400)
        self.assertEqual(app.parse_timestamp('00:05'), 5000)

    def test_sort_gaps_and_translation(self):
        first = self.row('00:01 - 00:02')
        first.korean = '번역문'
        result = app.render_srt([self.row('00:04 - 00:05'), first])
        self.assertTrue(result.startswith('1\n00:00:01,000 --> 00:00:02,000\n[화자 1] 번역문'))
        self.assertNotIn('00:00:02,000 --> 00:00:04,000', result)

    def test_invalid_ranges_rejected(self):
        for time in ['-', '00:00 - 00:00', '00:05 - 00:03', '00:60 - 01:00']:
            with self.subTest(time=time), self.assertRaises(ValueError):
                app.render_srt([self.row(time)])

    def test_export_separates_source_files(self):
        rows = [self.row('00:01 - 00:02'), self.row('00:01 - 00:02', '화자 2', '다른 파일')]
        rows[1].filename = 'other.wav'
        instance = SimpleNamespace(rows=rows, batch_running=False)
        with TemporaryDirectory() as directory:
            paths = [Path(directory) / 'one.srt', Path(directory) / 'two.srt']
            with patch.object(app.filedialog, 'asksaveasfilename', side_effect=list(map(str, paths))), patch.object(app.messagebox, 'showinfo'):
                app.App.export(instance)
            self.assertIn('안녕하세요', paths[0].read_text(encoding='utf-8-sig'))
            self.assertNotIn('다른 파일', paths[0].read_text(encoding='utf-8-sig'))
            self.assertIn('다른 파일', paths[1].read_text(encoding='utf-8-sig'))


if __name__ == '__main__':
    unittest.main()
