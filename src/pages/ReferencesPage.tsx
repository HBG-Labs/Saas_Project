import { PageHeader } from '@/components/layout/PageHeader';
import { ToolReferences } from '@/features/tools';

export default function ReferencesPage() {
  return (
    <>
      <PageHeader
        title="Références techniques & normes"
        description="Normes officielles, abaques de calcul, équations et guides de conformité pour vos interventions."
      />

      <div className="space-y-8">
        <ToolReferences
          tool={{
            slug: 'global-references',
            category: 'electrical',
            title: 'Électricité & Basse Tension (NF C 15-100 / UTE C 15-105)',
          }}
        />

        <ToolReferences
          tool={{
            slug: 'global-references-fiber',
            category: 'fiber-optics',
            title: 'Fibre Optique & FTTH (ITU-T G.652.D / UTE C 90-480)',
          }}
        />

        <ToolReferences
          tool={{
            slug: 'global-references-networking',
            category: 'networking',
            title: 'Réseaux IP, Sous-réseaux & Ethernet (RFC 4632 / IEEE 802.3)',
          }}
        />

        <ToolReferences
          tool={{
            slug: 'global-references-telecom',
            category: 'telecom',
            title: 'Télécoms & Faisceaux Hertziens (ITU-R P.530 / 3GPP)',
          }}
        />
      </div>
    </>
  );
}
