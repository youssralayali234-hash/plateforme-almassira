import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'AL MASSIRA | Gestion scolaire',description:'Plateforme de gestion et de suivi pédagogique'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
