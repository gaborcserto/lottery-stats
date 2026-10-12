import { ErrorPage } from '../components/ErrorPage'

export function meta() {
  return [
    { title: 'Az oldal nem található | Lottery Stats' },
    {
      name: 'description',
      content:
        'A kért oldal nem található. Térjen vissza a Lottery Stats kezdőlapjára.',
    },
    { name: 'robots', content: 'noindex' },
  ]
}
export default function NotFound() {
  return <ErrorPage status={404} />
}
