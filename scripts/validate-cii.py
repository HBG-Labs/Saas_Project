"""Validate generated CII fixtures with Factur-X 1.09.2 and EN 16931 1.3.16.

Install saxonche==12.10.0 and lxml, generate fixtures with
EXPORT_CII_FIXTURES=1 vitest, then run this script. --fetch downloads only the
public validation stylesheet and licence; invoice data stays local.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import urlopen
from importlib.metadata import version

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'test-results' / 'einvoice-validation'
sys.path.insert(0, str(ROOT / 'test-results' / 'einvoice-tools'))
from lxml import etree
from saxonche import PySaxonProcessor

VERSION = 'validation-1.3.16'
EXPECTED_XSLT_SHA256 = '0b234dea2bbfee739b7761e607a992c17fab88773014ef56355b6158cfb1cc53'
XSLT = CACHE / 'EN16931-CII-validation.xslt'
SAFE_PARSER = etree.XMLParser(resolve_entities=False, no_network=True)
PROFILE = ROOT / 'test-results' / 'einvoice-tools' / 'facturx' / 'xsd_and_schematron' / 'facturx-en16931'


def fetch(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=45) as response:
        target.write_bytes(response.read())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fetch', action='store_true')
    parser.add_argument('--folder', default=str(ROOT / 'test-results' / 'cii-fixtures'))
    parser.add_argument('--file', help='Validate one CII file, excluding other XML reports in its folder')
    options = parser.parse_args()
    if options.fetch:
        base = f'https://raw.githubusercontent.com/ConnectingEurope/eInvoicing-EN16931/{VERSION}/'
        fetch(base + 'cii/xslt/EN16931-CII-validation.xslt', XSLT)
        fetch(base + 'LICENSE.txt', CACHE / 'EN16931-LICENSE.txt')
    if hashlib.sha256(XSLT.read_bytes()).hexdigest() != EXPECTED_XSLT_SHA256:
        raise ValueError('Unexpected EN16931 CII validation artefact; review before accepting an update')
    if version('factur-x') != '6.8':
        raise ValueError('Install the pinned factur-x==6.8 validation artefacts')
    schema = etree.XMLSchema(etree.parse(str(PROFILE / 'Factur-X_EN16931.xsd'), SAFE_PARSER))
    files = [Path(options.file)] if options.file else sorted(Path(options.folder).glob('*.xml'))
    if not files:
        raise ValueError('No generated CII fixture to validate')
    report = {'rules': VERSION, 'profile': 'Factur-X 1.09.2 EN16931 (factur-x 6.8)', 'xslt_sha256': EXPECTED_XSLT_SHA256, 'profile_hashes': {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(PROFILE.iterdir()) if file.is_file()}, 'results': []}
    with PySaxonProcessor(license=False) as processor:
        transform = processor.new_xslt30_processor().compile_stylesheet(stylesheet_file=str(XSLT))
        profile_transform = processor.new_xslt30_processor().compile_stylesheet(stylesheet_file=str(PROFILE / 'Factur-X_1.09_EN16931.xsl'))
        for path in files:
            document = etree.parse(str(path), SAFE_PARSER)
            xsd_ok = schema.validate(document)
            xsd_errors = str(schema.error_log) if not xsd_ok else ''
            svrl = transform.transform_to_string(source_file=str(path))
            result = etree.fromstring(svrl.encode(), SAFE_PARSER)
            failures = [
                {'id': item.get('id'), 'flag': item.get('flag'), 'text': ''.join(item.itertext()).strip()}
                for item in result.xpath('//*[local-name()="failed-assert"]')
            ]
            profile_result = etree.fromstring(profile_transform.transform_to_string(source_file=str(path)).encode(), SAFE_PARSER)
            profile_failures = [{'id': item.get('id'), 'text': ''.join(item.itertext()).strip()} for item in profile_result.xpath('//*[local-name()="failed-assert"]')]
            report['results'].append({'file': path.name, 'xsd': xsd_ok, 'xsd_errors': xsd_errors, 'assertions': failures, 'profile_assertions': profile_failures})
            print(path.name + ': ' + ('PASS' if xsd_ok and not failures and not profile_failures else json.dumps(report['results'][-1], ensure_ascii=False)))
        broken = etree.parse(str(files[0]), SAFE_PARSER)
        amount = broken.xpath('//*[local-name()="DuePayableAmount"]')[0]
        amount.text = '999999.99'
        bad_path = CACHE / 'cii-negative-total.xml'
        broken.write(str(bad_path), encoding='UTF-8', xml_declaration=True)
        svrl = transform.transform_to_string(source_file=str(bad_path))
        failures = etree.fromstring(svrl.encode(), SAFE_PARSER).xpath('//*[local-name()="failed-assert"]')
        if not any(item.get('id') == 'BR-CO-16' for item in failures):
            raise AssertionError('The validator must reject the deliberately incorrect payable amount')
        report['negative_control'] = 'BR-CO-16 detected'
        broken_order = etree.parse(str(files[0]), SAFE_PARSER)
        agreement = broken_order.xpath('//*[local-name()="ApplicableHeaderTradeAgreement"]')[0]
        buyer_party = agreement.xpath('*[local-name()="BuyerTradeParty"]')[0]
        agreement.remove(buyer_party)
        agreement.insert(0, buyer_party)
        if schema.validate(broken_order):
            raise AssertionError('The XSD must reject a buyer placed before the seller')
        report['negative_structure_control'] = 'Invalid element order rejected by XSD'
    report_path = Path(options.file).parent if options.file else CACHE
    (report_path / 'cii-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if any(not result['xsd'] or result['assertions'] or result['profile_assertions'] for result in report['results']):
        raise SystemExit(1)
    print('All XSD, Factur-X and EN16931 assertions passed; both negative controls rejected.')


if __name__ == '__main__':
    main()
