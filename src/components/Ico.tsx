export type IcoName = 'lamp' | 'motion' | 'clock' | 'dial' | 'pen' | 'cross';

/**
 * Icons are `clip-path` on a `currentColor` block — DNA §10, zero asset files.
 * That constrains every icon to ONE closed polygon with no hole in it, which is
 * why a gear is not on this list and a fader is.
 */
export function Ico({ name }: { name: IcoName }) {
  return <i className="ico" data-ico={name} aria-hidden="true" />;
}
