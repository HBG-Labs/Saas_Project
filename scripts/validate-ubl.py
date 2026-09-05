"""Validate generated fixtures with OASIS UBL 2.1 and EC EN16931 1.3.16.

Install saxonche==12.10.0 and lxml, then run after EXPORT_UBL_FIXTURES=1 vitest.
--fetch downloads public validation artefacts only; invoice content stays local.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'test-results' / 'einvoice-validation'
sys.path.insert(0, str(ROOT / 'test-results' / 'einvoice-tools'))
from lxml import etree
from saxonche import PySaxonProcessor

VERSION = 'validation-1.3.16'
EXPECTED_XSLT_SHA256 = '39f9d282867f1a49e7708d9e29a53da89643e1ee56f10cec1ebcf1277595fcbd'
BASE = 'https://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/'
SCHEMAS = {
    f'{{urn:oasis:names:specification:ubl:schema:xsd:{name}-2}}{name}':
        CACHE / 'xsd' / 'maindoc' / f'UBL-{name}-2.1.xsd'
    for name in ('Invoice', 'CreditNote')
}
XSLT = CACHE / 'EN16931-UBL-validation.xslt'
SAFE_PARSER = etree.XMLParser(resolve_entities=False, no_network=True)

def fetch(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=45) as response:
        data = response.read()
    target.write_bytes(data)

def download_schemas(relative, seen=None):
    seen = seen if seen is not None else set()
    url = urljoin(BASE, relative)
    if not url.startswith(BASE):
        raise ValueError('Unexpected schema origin: ' + url)
    path = (CACHE / 'xsd' / url.removeprefix(BASE)).resolve()
    if not path.is_relative_to((CACHE / 'xsd').resolve()):
        raise ValueError('Schema path outside cache')
    if url in seen:
        return
    seen.add(url)
    fetch(url, path)
    doc = etree.parse(str(path), SAFE_PARSER)
    for child in doc.xpath('//*[@schemaLocation]/@schemaLocation'):
        child_url = urljoin(url, child)
        if not child_url.startswith(BASE):
            raise ValueError('Unexpected schema dependency: ' + child_url)
        download_schemas(child_url.removeprefix(BASE), seen)

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--fetch', action='store_true')
    args.add_argument('--fetch-credit-schema', action='store_true')
    selection = args.add_mutually_exclusive_group()
    selection.add_argument('--folder', type=Path, default=ROOT / 'test-results' / 'ubl-fixtures')
    selection.add_argument('--file', type=Path)
    options = args.parse_args()
    if options.fetch:
        download_schemas('maindoc/UBL-Invoice-2.1.xsd')
        fetch(f'https://raw.githubusercontent.com/ConnectingEurope/eInvoicing-EN16931/{VERSION}/ubl/xslt/EN16931-UBL-validation.xslt', XSLT)
        fetch(f'https://raw.githubusercontent.com/ConnectingEurope/eInvoicing-EN16931/{VERSION}/LICENSE.txt', CACHE / 'EN16931-LICENSE.txt')
    if options.fetch or options.fetch_credit_schema:
        download_schemas('maindoc/UBL-CreditNote-2.1.xsd')
    if hashlib.sha256(XSLT.read_bytes()).hexdigest() != EXPECTED_XSLT_SHA256:
        raise ValueError('Unexpected EN16931 validation artefact; review before accepting an update')
    schemas = {}
    files = [options.file] if options.file else sorted(options.folder.glob('*.xml'))
    if not files:
        raise ValueError('No generated XML fixture to validate')
    report = {'rules': VERSION, 'xslt_sha256': hashlib.sha256(XSLT.read_bytes()).hexdigest(), 'results': []}
    with PySaxonProcessor(license=False) as processor:
        transform = processor.new_xslt30_processor().compile_stylesheet(stylesheet_file=str(XSLT))
        for path in files:
            doc = etree.parse(str(path), SAFE_PARSER)
            tag = doc.getroot().tag
            if tag not in SCHEMAS:
                raise ValueError('Unsupported UBL document root: ' + tag)
            if tag not in schemas:
                schemas[tag] = etree.XMLSchema(etree.parse(str(SCHEMAS[tag]), SAFE_PARSER))
            schemas[tag].assertValid(doc)
            svrl = transform.transform_to_string(source_file=str(path))
            result = etree.fromstring(svrl.encode(), SAFE_PARSER)
            failures = [{'id': a.get('id'), 'flag': a.get('flag'), 'text': ''.join(a.itertext()).strip()} for a in result.xpath('//*[local-name()="failed-assert"]')]
            report['results'].append({'file': path.name, 'xsd': 'pass', 'assertions': failures})
            print(path.name + ': ' + ('PASS' if not failures else json.dumps(failures, ensure_ascii=False)))
        # Prove that the independent validator detects a broken monetary total.
        broken = etree.parse(str(files[0]), SAFE_PARSER)
        amount = broken.xpath('//*[local-name()="PayableAmount"]')[0]
        amount.text = '999999.99'
        bad_path = CACHE / 'negative-total.xml'
        broken.write(str(bad_path), encoding='UTF-8', xml_declaration=True)
        svrl = transform.transform_to_string(source_file=str(bad_path))
        errors = etree.fromstring(svrl.encode(), SAFE_PARSER).xpath('//*[local-name()="failed-assert"]')
        if not any(e.get('id') == 'BR-CO-16' for e in errors):
            raise AssertionError('The validator must reject the deliberately incorrect payable amount')
        report['negative_control'] = 'BR-CO-16 detected'
    (files[0].parent / 'ubl-validation-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if any(r['assertions'] for r in report['results']):
        raise SystemExit(1)
    print('All XSD and EN16931 assertions passed; negative control rejected.')

if __name__ == '__main__':
    main()
