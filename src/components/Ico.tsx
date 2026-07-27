export function Ico({ name }: { name: 'lamp' | 'motion' | 'clock' }) {
  return <i className="ico" data-ico={name} aria-hidden="true" />;
}
