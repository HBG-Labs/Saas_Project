"""Independent PDF/A-3b, attachment, metadata and layout checks on synthetic fixtures."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from lxml import etree
from pypdf import PdfReader
import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / 'test-results' / 'facturx-fixtures'
FX = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--java', required=True)
    parser.add_argument('--verapdf-jar', required=True)
    parser.add_argument('--folder', default=str(FOLDER))
    parser.add_argument('--expected-count', type=int, default=5)
    parser.add_argument('--test-mode', action='store_true', help='Require TEST markers in every page and the embedded XML')
    args = parser.parse_args()
    folder = Path(args.folder)
    files = sorted(folder.glob('*.pdf'))
    if args.expected_count < 1 or len(files) != args.expected_count:
        raise ValueError(f'Expected {args.expected_count} synthetic PDF fixture(s), found {len(files)}')
    result = subprocess.run([args.java, '-Djava.awt.headless=true', '-jar', args.verapdf_jar,
                             '--format', 'xml', '--flavour', '3b', *map(str, files)],
                            capture_output=True, check=True, timeout=90)
    (folder / 'verapdf-report.xml').write_bytes(result.stdout)
    validation = etree.fromstring(result.stdout)
    reports = validation.xpath('//*[local-name()="validationReport"]')
    if len(reports) != len(files) or any(item.get('isCompliant') != 'true' for item in reports):
        raise AssertionError('Every generated PDF must pass veraPDF PDF/A-3b validation')
    report = {'pdfa': 'veraPDF 1.30.2, PDF/A-3b', 'results': []}
    for file in files:
        reader = PdfReader(file)
        xml = file.with_suffix('.xml').read_bytes()
        xml_doc = etree.fromstring(xml)
        is_credit = xml_doc.xpath('string(//*[local-name()="ExchangedDocument"]/*[local-name()="TypeCode"])') == '381'
        if args.test_mode:
            assert reader.metadata.title == ('TEST - Simulation d’avoir' if is_credit else 'TEST - Simulation de facture')
            assert b'TEST - SIMULATION SANS EMISSION - NE PAS COMPTABILISER.' in xml
            assert b'<ram:ID>TEST-' in xml
        assert list(reader.attachments) == ['factur-x.xml']
        assert reader.attachments['factur-x.xml'] == [xml], 'The attached invoice must match the validated CII byte for byte'
        root = reader.trailer['/Root']
        assert len(root['/AF']) == 1
        assert root['/AF'][0].get_object()['/AFRelationship'] == '/Alternative'
        metadata = etree.fromstring(root['/Metadata'].get_data())
        for name, expected in {'DocumentFileName': 'factur-x.xml', 'DocumentType': 'INVOICE', 'Version': '1.0', 'ConformanceLevel': 'EN 16931'}.items():
            assert metadata.find('.//{' + FX + '}' + name).text == expected
        if file.stem == 'standard':
            assert len(reader.pages) == 1, 'A complete short invoice should fit on one page'
        with pdfplumber.open(file) as document:
            all_text = '\n'.join(page.extract_text() for page in document.pages)
            if is_credit:
                original_ref = xml_doc.xpath('string(//*[local-name()="InvoiceReferencedDocument"]/*[local-name()="IssuerAssignedID"])')
                assert original_ref and original_ref in all_text
                if b'Avoir partiel.' in xml:
                    assert 'Avoir partiel' in all_text
                assert 'Total à créditer' in all_text
                assert 'REMBOURSEMENT OU IMPUTATION' in all_text
                assert 'Motif de l’avoir' in all_text
                assert 'IBAN :' not in all_text
            for index, page in enumerate(document.pages):
                extracted = page.extract_text()
                if args.test_mode:
                    assert ('AVOIR - TEST' if is_credit else 'FACTURE - TEST') in extracted
                    assert ('TEST - NON EMIS - NE PAS COMPTABILISER' if is_credit else 'TEST - NON EMISE - NE PAS COMPTABILISER') in extracted
                elif is_credit:
                    assert 'AVOIR' in extracted
                assert f'Page {index + 1} / {len(document.pages)}' in extracted
                assert len(extracted) > 110, 'No empty page caused by a footer overflow'
                for char in page.chars:
                    assert 42 <= char['x0'] <= char['x1'] <= page.width - 42, f'Horizontal overflow: {file.name}'
                    assert 35 <= char['top'] <= char['bottom'] <= 800, f'Vertical overflow: {file.name}'
        report['results'].append({'file': file.name, 'pages': len(reader.pages), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'xml_sha256': hashlib.sha256(xml).hexdigest(), 'attachment': 'exact', 'metadata': 'PASS', 'layout': 'PASS'})
        print(file.name + ': PASS (PDF/A-3b, exact XML, XMP, page bounds)')
    (folder / 'pdf-validation-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
