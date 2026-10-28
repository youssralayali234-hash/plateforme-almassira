
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  signIn,
  signOut,
  useSession,
  SessionProvider
} from 'next-auth/react';

type Item = Record<string, any>;

const groups = [
  'students',
  'courses',
  'assessments',
  'users',
  'submissions'
] as const;

const labels: Record<string, string> = {
  students: 'Élèves',
  courses: 'Cours',
  assessments: 'Évaluations',
  users: 'Comptes',
  submissions: 'Copies'
};

const columns: Record<string, [string, string, boolean?][]> = {
  students: [
    ['first_name', 'Prénom'],
    ['last_name', 'Nom'],
    ['class_name', 'Classe'],
    ['student_number', 'Numéro']
  ],
  courses: [
    ['title', 'Titre'],
    ['class_name', 'Classe'],
    ['description', 'Objectifs'],
    ['content', 'Contenu', true]
  ],
  assessments: [
    ['title', 'Titre'],
    ['class_name', 'Classe'],
    ['description', 'Description']
  ],
  users: [
    ['name', 'Nom'],
    ['identifier', 'Identifiant'],
    ['password', 'Mot de passe']
  ]
};

async function api(
  path: string,
  method = 'GET',
  body?: unknown
) {
  const r = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });

  const j = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(j.detail || `Erreur (${r.status})`);
  }

  return j;
}

function Field({
  name,
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  required = false
}: {
  name: string;
  label: string;
  value: any;
  onChange: (x: string) => void;
  multiline?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {multiline ? (
        <textarea
          name={name}
          className="field min-h-28"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          name={name}
          className="field"
          type={type}
          value={value ?? ''}
          required={required}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function MediaAttachments({ item }: { item: Item }) {
  return (
    <div className="space-y-4">
      {item.file_url && (
        <div className="space-y-2">
          <a
            className="inline-block text-blue-700 underline font-semibold"
            target="_blank"
            rel="noreferrer"
            href={item.file_url}
          >
            Ouvrir / télécharger le document PDF
          </a>
          <iframe
            className="w-full h-[480px] border rounded-xl bg-white"
            title="Document PDF"
            src={item.file_url}
          />
        </div>
      )}

      {(item.image_urls || []).length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {(item.image_urls || []).map(
            (url: string, i: number) => (
              <a
                key={url + i}
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  loading="lazy"
                  className="w-full max-h-[420px] object-contain bg-white rounded-xl border"
                  src={url}
                  alt={'Illustration ' + (i + 1)}
                />
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const { data: session, status } = useSession();

  const [space, setSpace] = useState('');
  const [pendingSpace, setPendingSpace] = useState('');
  const [tab, setTab] = useState('courses');

  const [items, setItems] = useState<Item[]>([]);
  const [edit, setEdit] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const [credentials, setCredentials] = useState({
    identifier: '',
    password: ''
  });

  const [authRole, setAuthRole] = useState('teacher');
  const [selected, setSelected] = useState<Item | null>(null);

  const [courses, setCourses] = useState<Item[]>([]);
  const [assessments, setAssessments] = useState<Item[]>([]);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [identity, setIdentity] = useState({
    full_name: '',
    class_name: '',
    student_number: '',
    student_code: ''
  });

  const [parentCode, setParentCode] = useState('');
  const [parentResult, setParentResult] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!space || !['teacher', 'admin'].includes(space) || !session) {
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      setItems(await api(tab));
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  }, [space, tab, session]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (space !== 'student') return;

    Promise.all([
      api('public/courses'),
      api('public/assessments')
    ])
      .then(([c, a]) => {
        setCourses(c);
        setAssessments(a);
      })
      .catch(e => setNotice(e.message));
  }, [space]);

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice('');

    try {
      const r = await signIn('credentials', {
        identifier: credentials.identifier,
        password: credentials.password,
        redirect: false
      });

      if (r?.error) {
        throw Error('Identifiant ou mot de passe incorrect');
      }
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadMedia = async (
    file: File,
    field: 'file_url' | 'image_urls'
  ) => {
    setLoading(true);
    setNotice('');

    try {
      const form = new FormData();
      form.append('file', file);

      const r = await fetch('/api/upload', {
        method: 'POST',
        body: form
      });

      const result = await r.json();

      if (!r.ok) {
        throw Error(result.detail || 'Importation impossible');
      }

      setEdit(p => {
        if (!p) return null;

        if (field === 'file_url') {
          return {
            ...p,
            file_url: result.url,
            file_name: result.filename
          };
        }

        return {
          ...p,
          image_urls: [
            ...(p.image_urls || []),
            result.url
          ]
        };
      });

      setNotice(
        'Fichier importé. Cliquez sur Enregistrer pour publier les modifications.'
      );
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;

    setLoading(true);
    setNotice('');

    try {
      const data = { ...edit };
      delete data.id;

      if (tab === 'assessments') {
        delete data.questions_text;
        data.questions = data.questions || [];
        data.kind = data.kind || 'exam';
      }

      if (tab === 'users') {
        data.role = edit.id ? edit.role : authRole;
        if (!data.password) delete data.password;
      }

      if (tab === 'courses' || tab === 'assessments') {
        data.published = Boolean(data.published);
      }

      await api(
        edit.id
          ? `${tab}/${encodeURIComponent(edit.id)}`
          : tab,
        edit.id ? 'PUT' : 'POST',
        { data }
      );

      setEdit(null);
      await load();
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };

  const del = async (id: string) => {
    if (!window.confirm('Confirmer la suppression ?')) return;

    try {
      await api(tab + '/' + encodeURIComponent(id), 'DELETE');
      await load();
    } catch (e: any) {
      setNotice(e.message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setLoading(true);
    setNotice('');

    try {
      await api('public/submit', 'POST', {
        assessment_id: selected.id,
        ...identity,
        answers
      });

      setNotice('Votre copie a été enregistrée.');
      setSelected(null);
      setAnswers({});
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };

  const parent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice('');

    try {
      setParentResult(
        await api('parent/access', 'POST', {
          ...identity,
          parent_code: parentCode
        })
      );
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };

  const setCode = async (
    id: string,
    kind: 'student-code' | 'parent-code'
  ) => {
    const code = window.prompt(
      kind === 'student-code'
        ? 'Définir un code confidentiel élève (8 caractères minimum)'
        : 'Définir un code confidentiel parent (8 caractères minimum)'
    );

    if (!code) return;

    if (code.length < 8) {
      setNotice('Le code doit comporter au moins 8 caractères.');
      return;
    }

    try {
      await api(
        'students/' + encodeURIComponent(id) + '/' + kind,
        'POST',
        { code }
      );

      setNotice('Code confidentiel enregistré.');
    } catch (e: any) {
      setNotice(e.message);
    }
  };

  const beginEdit = (x: Item = {}) => {
    setNotice('');

    setEdit({
      ...x,
      ...(tab === 'assessments'
        ? { questions: x.questions || [] }
        : {})
    });

    if (tab === 'users') {
      setAuthRole(x.role || 'teacher');
    }
  };

  useEffect(() => {
    if (!pendingSpace) return;

    const timer = window.setTimeout(() => {
      setSpace(pendingSpace);
      setPendingSpace('');
    }, 850);

    return () => window.clearTimeout(timer);
  }, [pendingSpace]);

  const navColor: Record<string, string> = {
    student: 'bg-blue-100',
    teacher: 'bg-green-100',
    parent: 'bg-rose-100',
    admin: 'bg-violet-100'
  };

  const bar = navColor[pendingSpace || space] || 'bg-white';

  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(135deg,#edf5ff,#f8fbff_55%,#e9f2fc)] text-slate-800">
      <header className={`border-b shadow-sm transition-colors duration-300 ${bar}`}>
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-16 w-16 items-center justify-center shrink-0"
              aria-label="Logo livre vert AL MASSIRA"
            >
              <svg
                viewBox="0 0 48 48"
                className="h-16 w-16"
                role="img"
                aria-label="Livre vert"
              >
                <path d="M24 11c-6-4-13-4-19-2v27c8-2 14 0 19 4V11Z" fill="#16a34a" />
                <path d="M24 11c6-4 13-4 19-2v27c-8-2-14 0-19 4V11Z" fill="#16a34a" />
                <path d="M24 11v29" stroke="#14532d" strokeWidth="2" />
                <path d="M9 15c5-1 9 0 12 2M27 17c3-2 7-3 12-2M9 22c5-1 9 0 12 2M27 24c3-2 7-3 12-2" fill="none" stroke="#14532d" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <strong className="text-2xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              AL MASSIRA
            </strong>
          </div>

          <div className="flex gap-2 items-center">
            {space && (
              <button
                className="rounded-xl bg-white/95 text-slate-800 px-4 py-2.5 font-semibold"
                onClick={() => {
                  setSpace('');
                  setEdit(null);
                  setSelected(null);
                  setNotice('');
                }}
              >
                Accueil
              </button>
            )}

            {session && (
              <button
                className="rounded-xl bg-white/95 text-slate-800 px-4 py-2.5 font-semibold"
                onClick={() => signOut({ redirect: false })}
              >
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </header>

    
<main
  className="mx-auto w-full max-w-7xl flex-1 px-5 py-9"
  style={!space ? {
    backgroundImage: "url('/imagefinal.png')",
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    minHeight: '85vh',
    maxWidth: '100%'
  } : undefined}
>

        {!space ? (
         
<section className="mx-auto max-w-4xl pt-7 md:pt-14 pb-12 flex flex-col justify-end min-h-[75vh]">

        <h1 className="text-xl md:text-2xl font-extrabold mb-7 tracking-wide drop-shadow-sm" style={{ color: '#2563EB' }}>
  Accéder à votre espace :
</h1>

            <div className="rounded-[25px] border border-white bg-white/85 shadow-lg p-5 md:p-9">
              <div className="grid grid-cols-2 gap-3 md:gap-6">
                {[
                  ['student', 'Élève', 'bg-blue-100'],
                  ['teacher', 'Professeur', 'bg-green-100'],
                  ['parent', 'Parent', 'bg-rose-100'],
                  ['admin', 'Administration', 'bg-violet-100']
                ].map(([k, name, color]) => (
                  <button
                    key={k}
                    type="button"
                    className={`role-card-asymmetric min-h-[92px] md:min-h-[115px] text-center text-base md:text-xl transition-all ${pendingSpace === k ? color : 'hover:bg-blue-50'}`}
                    disabled={Boolean(pendingSpace)}
                    onClick={() => {
                      setPendingSpace(k);
                      setAuthRole(k);
                      setNotice('');
                    }}
                  >
                    <span className="font-bold">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            {space === 'student' && (
              <div className="grid lg:grid-cols-[310px_1fr] gap-6">
                <aside className="panel">
                  <h2 className="section-title">Mes cours</h2>

                  {courses.length ? (
                    courses.map(c => (
                      <button
                        key={c.id}
                        className="nav-item"
                        onClick={() => {
                          setSelected({ ...c, _type: 'course' });
                          setNotice('');
                        }}
                      >
                        {c.title}
                      </button>
                    ))
                  ) : (
                    <p className="empty">Aucun cours publié.</p>
                  )}

                  <h2 className="section-title mt-7">Examens</h2>

                  {assessments
                    .filter(a => a.kind === 'exam')
                    .map(a => (
                      <button
                        key={a.id}
                        className="nav-item"
                        onClick={() => {
                          setSelected({ ...a, _type: 'assessment' });
                          setAnswers({});
                          setNotice('');
                        }}
                      >
                        {a.title}
                      </button>
                    ))}

                  <h2 className="section-title mt-7">Exercices</h2>

                  {assessments
                    .filter(a => a.kind !== 'exam')
                    .map(a => (
                      <button
                        key={a.id}
                        className="nav-item"
                        onClick={() => {
                          setSelected({ ...a, _type: 'assessment' });
                          setAnswers({});
                          setNotice('');
                        }}
                      >
                        {a.title}
                      </button>
                    ))}
                </aside>

                <section className="panel">
                  <h2 className="section-title">
                    {selected?.title || 'Mes activités'}
                  </h2>

                  {!selected ? (
                    <p className="empty">
                      Sélectionnez un cours, un examen ou un exercice.
                    </p>
                  ) : selected._type === 'course' ? (
                    <div className="space-y-4">
                      <p className="text-slate-500">
                        {selected.class_name}
                      </p>
                      <p>{selected.description}</p>
                      <article className="whitespace-pre-wrap">
                        {selected.content}
                      </article>
                      <MediaAttachments item={selected} />
                    </div>
                  ) : (
                    <form onSubmit={submit} className="space-y-5">
                      <p className="text-slate-500">
                        {selected.description}
                      </p>

                      <MediaAttachments item={selected} />

                      <div className="grid sm:grid-cols-3 gap-4">
                        {Object.entries(identity).map(([key, value]) => (
                          <Field
                            key={key}
                            name={key}
                            label={
                              ({
                                full_name: 'Nom complet',
                                class_name: 'Classe',
                                student_number: 'Numéro de l’élève',
                                student_code: 'Code personnel élève'
                              } as Record<string, string>)[key] || key
                            }
                            type={key === 'student_code' ? 'password' : 'text'}
                            value={value}
                            required
                            onChange={v =>
                              setIdentity(p => ({
                                ...p,
                                [key]: v
                              }))
                            }
                          />
                        ))}
                      </div>

                      {(selected.questions || []).map(
                        (q: Item, i: number) => (
                          <fieldset
                            key={q.id || i}
                            className="rounded-xl border p-4"
                          >
                            <legend className="font-semibold px-2">
                              {i + 1}. {q.text} ({q.points || 1} pt)
                            </legend>

                            {q.type === 'mcq' ? (
                              (q.options || []).map((option: string) => (
                                <label key={option} className="flex gap-2 mt-2">
                                  <input
                                    type="radio"
                                    name={q.id}
                                    value={option}
                                    checked={answers[q.id] === option}
                                    onChange={() =>
                                      setAnswers(p => ({
                                        ...p,
                                        [q.id]: option
                                      }))
                                    }
                                  />
                                  {option}
                                </label>
                              ))
                            ) : q.type === 'truefalse' ? (
                              ['Vrai', 'Faux'].map(option => (
                                <label key={option} className="flex gap-2 mt-2">
                                  <input
                                    type="radio"
                                    name={q.id}
                                    checked={answers[q.id] === option}
                                    onChange={() =>
                                      setAnswers(p => ({
                                        ...p,
                                        [q.id]: option
                                      }))
                                    }
                                  />
                                  {option}
                                </label>
                              ))
                            ) : (
                              <textarea
                                className="field"
                                value={answers[q.id] || ''}
                                onChange={e =>
                                  setAnswers(p => ({
                                    ...p,
                                    [q.id]: e.target.value
                                  }))
                                }
                              />
                            )}
                          </fieldset>
                        )
                      )}

                      <button className="btn-primary" disabled={loading}>
                        Envoyer ma copie
                      </button>
                    </form>
                  )}
                </section>
              </div>
            )}

            {space === 'parent' && (
              <div className="max-w-3xl panel">
                <h2 className="section-title">Suivi scolaire</h2>

                <form
                  onSubmit={parent}
                  className="grid sm:grid-cols-2 gap-4"
                >
                  {Object.entries(identity)
                    .filter(([key]) => key !== 'student_code')
                    .map(([key, value]) => (
                      <Field
                        key={key}
                        name={key}
                        label={
                          ({
                            full_name: 'Nom complet',
                            class_name: 'Classe',
                            student_number: 'Numéro de l’élève'
                          } as Record<string, string>)[key] || key
                        }
                        value={value}
                        required
                        onChange={v =>
                          setIdentity(p => ({
                            ...p,
                            [key]: v
                          }))
                        }
                      />
                    ))}

                  <Field
                    name="parent_code"
                    label="Code confidentiel Parent"
                    type="password"
                    value={parentCode}
                    required
                    onChange={setParentCode}
                  />

                  <div className="sm:col-span-2">
                    <button className="btn-primary" disabled={loading}>
                      Consulter les résultats
                    </button>
                  </div>
                </form>

                {parentResult && (
                  <div className="mt-6">
                    <h3 className="font-bold mb-3">
                      Résultats de {parentResult.student?.full_name}
                    </h3>

                    {parentResult.results?.length ? (
                      parentResult.results.map((r: Item) => (
                        <div key={r.id} className="result-row">
                          <span>{r.assessment_title}</span>
                          <strong>
                            {r.score} / {r.total}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="empty">Aucun résultat disponible.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {['teacher', 'admin'].includes(space) && (
              status === 'loading' ? (
                <p>Chargement de votre session…</p>
              ) : !session ? (
                <div className="panel max-w-md mx-auto">
                  <h2 className="section-title">Connexion sécurisée</h2>

                  <form onSubmit={authenticate} className="space-y-5">
                    <Field
                      name="identifier"
                      label="Identifiant"
                      value={credentials.identifier}
                      required
                      onChange={v =>
                        setCredentials(p => ({
                          ...p,
                          identifier: v
                        }))
                      }
                    />

                    <Field
                      name="password"
                      label="Mot de passe"
                      type="password"
                      value={credentials.password}
                      required
                      onChange={v =>
                        setCredentials(p => ({
                          ...p,
                          password: v
                        }))
                      }
                    />

                    <button
                      className="btn-primary w-full"
                      disabled={loading}
                    >
                      Se connecter
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid md:grid-cols-[220px_1fr] gap-6">
                  <nav className="panel self-start flex flex-col gap-2">
                    {groups
                      .filter(g =>
                        space === 'admin' ||
                        ['courses', 'assessments', 'submissions'].includes(g)
                      )
                      .map(g => (
                        <button
                          key={g}
                          onClick={() => {
                            setTab(g);
                            setEdit(null);
                            setNotice('');
                          }}
                          className={
                            'nav-item ' +
                            (tab === g
                              ? space === 'teacher'
                                ? '!bg-green-100 !text-green-950'
                                : '!bg-violet-100 !text-violet-950'
                              : '')
                          }
                        >
                          {labels[g]}
                        </button>
                      ))}
                  </nav>

                  <section className="panel min-w-0">
                    <div className="flex justify-between items-center gap-3 mb-5">
                      <h2 className="section-title !mb-0">
                        {labels[tab]}
                      </h2>

                      {tab !== 'submissions' && (
                        <button
                          className="btn-primary"
                          onClick={() => beginEdit()}
                        >
                          Ajouter
                        </button>
                      )}
                    </div>

                    {edit ? (
                      <form onSubmit={save} className="space-y-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {(columns[tab] || []).map(
                            ([key, label, multi]) => (
                              <Field
                                key={key}
                                name={key}
                                label={label}
                                multiline={multi}
                                type={key === 'password' ? 'password' : 'text'}
                                value={edit[key] || ''}
                                required={['title', 'identifier'].includes(key)}
                                onChange={v =>
                                  setEdit(p =>
                                    p ? { ...p, [key]: v } : null
                                  )
                                }
                              />
                            )
                          )}

                          {['courses', 'assessments'].includes(tab) && (
                            <div className="sm:col-span-2 rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-4">
                              <h3 className="font-bold">
                                Documents et images
                              </h3>

                              <label className="block text-sm font-semibold">
                                Importer un cours, exercice ou examen PDF
                                (15 Mo maximum)

                                <input
                                  className="field mt-2"
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  disabled={loading}
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadMedia(f, 'file_url');
                                    e.target.value = '';
                                  }}
                                />
                              </label>

                              {edit.file_url && (
                                <div className="flex gap-3 items-center">
                                  <a
                                    className="text-blue-700 underline"
                                    href={edit.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Voir le document PDF
                                  </a>

                                  <button
                                    type="button"
                                    className="text-rose-700"
                                    onClick={() =>
                                      setEdit(p =>
                                        p
                                          ? {
                                              ...p,
                                              file_url: null,
                                              file_name: null
                                            }
                                          : null
                                      )
                                    }
                                  >
                                    Retirer
                                  </button>
                                </div>
                              )}

                              <label className="block text-sm font-semibold">
                                Ajouter des images (JPG, PNG, WebP)

                                <input
                                  className="field mt-2"
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  multiple
                                  disabled={loading}
                                  onChange={async e => {
                                    const files = Array.from(
                                      e.target.files || []
                                    );
                                    e.target.value = '';

                                    for (const f of files) {
                                      await uploadMedia(f, 'image_urls');
                                    }
                                  }}
                                />
                              </label>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {(edit.image_urls || []).map(
                                  (url: string, i: number) => (
                                    <div key={url + i}>
                                      <img
                                        src={url}
                                        alt={'Illustration ' + (i + 1)}
                                        className="w-full h-28 object-contain bg-white rounded"
                                      />

                                      <button
                                        type="button"
                                        className="text-rose-700 text-sm"
                                        onClick={() =>
                                          setEdit(p =>
                                            p
                                              ? {
                                                  ...p,
                                                  image_urls: (p.image_urls || []).filter(
                                                    (_: string, j: number) =>
                                                      j !== i
                                                  )
                                                }
                                              : null
                                          )
                                        }
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {tab === 'users' && (
                            <label className="block text-sm font-semibold text-slate-700">
                              Rôle
                              <select
                                className="field"
                                value={edit.role || authRole}
                                onChange={e => {
                                  setAuthRole(e.target.value);
                                  setEdit(p =>
                                    p
                                      ? { ...p, role: e.target.value }
                                      : null
                                  );
                                }}
                              >
                                <option value="teacher">Professeur</option>
                                <option value="admin">Administrateur</option>
                              </select>
                            </label>
                          )}

                          {tab === 'assessments' && (
                            <>
                              <label className="block text-sm font-semibold text-slate-700">
                                Type
                                <select
                                  className="field"
                                  value={edit.kind || 'exam'}
                                  onChange={e =>
                                    setEdit(p =>
                                      p
                                        ? { ...p, kind: e.target.value }
                                        : null
                                    )
                                  }
                                >
                                  <option value="exam">Examen</option>
                                  <option value="exercise">Exercice</option>
                                </select>
                              </label>

                              <div className="sm:col-span-2 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-bold">
                                    Questions et barème
                                  </h3>

                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() =>
                                      setEdit(p =>
                                        p
                                          ? {
                                              ...p,
                                              questions: [
                                                ...(p.questions || []),
                                                {
                                                  id: crypto.randomUUID(),
                                                  type: 'mcq',
                                                  text: '',
                                                  options: ['', ''],
                                                  correct: '',
                                                  points: 1
                                                }
                                              ]
                                            }
                                          : null
                                      )
                                    }
                                  >
                                    Ajouter une question
                                  </button>
                                </div>

                                {(edit.questions || []).map(
                                  (q: Item, i: number) => (
                                    <div
                                      key={q.id || i}
                                      className="rounded-xl border border-slate-200 p-4 space-y-4"
                                    >
                                      <div className="flex justify-between items-center">
                                        <strong>Question {i + 1}</strong>

                                        <button
                                          type="button"
                                          className="text-rose-700"
                                          onClick={() =>
                                            setEdit(p =>
                                              p
                                                ? {
                                                    ...p,
                                                    questions: (p.questions || []).filter(
                                                      (_: Item, j: number) =>
                                                        j !== i
                                                    )
                                                  }
                                                : null
                                            )
                                          }
                                        >
                                          Supprimer
                                        </button>
                                      </div>

                                      <Field
                                        name="text"
                                        label="Énoncé"
                                        value={q.text || ''}
                                        onChange={v =>
                                          setEdit(p =>
                                            p
                                              ? {
                                                  ...p,
                                                  questions: (p.questions || []).map(
                                                    (z: Item, j: number) =>
                                                      j === i
                                                        ? { ...z, text: v }
                                                        : z
                                                  )
                                                }
                                              : null
                                          )
                                        }
                                      />

                                      <div className="grid sm:grid-cols-2 gap-4">
                                        <label className="text-sm font-semibold">
                                          Type
                                          <select
                                            className="field"
                                            value={q.type || 'mcq'}
                                            onChange={e =>
                                              setEdit(p =>
                                                p
                                                  ? {
                                                      ...p,
                                                      questions: (p.questions || []).map(
                                                        (z: Item, j: number) =>
                                                          j === i
                                                            ? {
                                                                ...z,
                                                                type: e.target.value
                                                              }
                                                            : z
                                                      )
                                                    }
                                                  : null
                                              )
                                            }
                                          >
                                            <option value="mcq">QCM</option>
                                            <option value="truefalse">Vrai / Faux</option>
                                            <option value="short">Réponse courte</option>
                                            <option value="long">Réponse rédigée</option>
                                          </select>
                                        </label>

                                        <Field
                                          name="points"
                                          label="Points"
                                          type="number"
                                          value={q.points ?? 1}
                                          onChange={v =>
                                            setEdit(p =>
                                              p
                                                ? {
                                                    ...p,
                                                    questions: (p.questions || []).map(
                                                      (z: Item, j: number) =>
                                                        j === i
                                                          ? {
                                                              ...z,
                                                              points: Number(v)
                                                            }
                                                          : z
                                                    )
                                                  }
                                                : null
                                            )
                                          }
                                        />
                                      </div>

                                      {q.type === 'mcq' && (
                                        <Field
                                          name="options"
                                          label="Propositions (une par ligne)"
                                          multiline
                                          value={(q.options || []).join('\n')}
                                          onChange={v =>
                                            setEdit(p =>
                                              p
                                                ? {
                                                    ...p,
                                                    questions: (p.questions || []).map(
                                                      (z: Item, j: number) =>
                                                        j === i
                                                          ? {
                                                              ...z,
                                                              options: v.split('\n')
                                                            }
                                                          : z
                                                    )
                                                  }
                                                : null
                                            )
                                          }
                                        />
                                      )}

                                      {q.type !== 'long' && (
                                        <Field
                                          name="correct"
                                          label="Réponse correcte"
                                          value={q.correct || ''}
                                          onChange={v =>
                                            setEdit(p =>
                                              p
                                                ? {
                                                    ...p,
                                                    questions: (p.questions || []).map(
                                                      (z: Item, j: number) =>
                                                        j === i
                                                          ? { ...z, correct: v }
                                                          : z
                                                    )
                                                  }
                                                : null
                                            )
                                          }
                                        />
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </>
                          )}

                          {['courses', 'assessments'].includes(tab) && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(edit.published)}
                                onChange={e =>
                                  setEdit(p =>
                                    p
                                      ? { ...p, published: e.target.checked }
                                      : null
                                  )
                                }
                              />
                              Publier pour les élèves
                            </label>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <button
                            className="btn-primary"
                            disabled={loading}
                          >
                            Enregistrer
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEdit(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </form>
                    ) : loading ? (
                      <p>Chargement…</p>
                    ) : items.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-slate-500">
                              <th className="py-3">Nom / Titre</th>
                              <th>Classe / Informations</th>
                              <th className="text-right">Actions</th>
                            </tr>
                          </thead>

                          <tbody>
                            {items.map(x => (
                              <tr
                                key={x.id}
                                className="border-b last:border-0"
                              >
                                <td className="py-4 font-semibold">
                                  {x.title ||
                                    x.name ||
                                    [x.first_name, x.last_name]
                                      .filter(Boolean)
                                      .join(' ') ||
                                    x.assessment_title ||
                                    x.identifier ||
                                    x.id}
                                </td>

                                <td>
                                  {x.class_name ||
                                    x.identifier ||
                                    x.student_number ||
                                    ''}
                                </td>

                                <td className="text-right whitespace-nowrap">
                                  {tab === 'submissions' && (
                                    <a
                                      className="text-teal-700 font-semibold px-2"
                                      href={'/api/submissions/' + x.id + '/pdf'}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      PDF
                                    </a>
                                  )}

                                  {tab === 'students' &&
                                    space === 'admin' && (
                                      <>
                                        <button
                                          className="text-teal-700 font-semibold px-2"
                                          onClick={() =>
                                            setCode(x.id, 'student-code')
                                          }
                                        >
                                          Code élève
                                        </button>

                                        <button
                                          className="text-teal-700 font-semibold px-2"
                                          onClick={() =>
                                            setCode(x.id, 'parent-code')
                                          }
                                        >
                                          Code parent
                                        </button>
                                      </>
                                    )}

                                  {tab !== 'submissions' && (
                                    <>
                                      <button
                                        className="text-teal-700 font-semibold px-2"
                                        onClick={() => beginEdit(x)}
                                      >
                                        Modifier
                                      </button>

                                      <button
                                        className="text-rose-700 font-semibold px-2"
                                        onClick={() => del(x.id)}
                                      >
                                        Supprimer
                                      </button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="empty">Aucun élément enregistré.</p>
                    )}
                  </section>
                </div>
              )
            )}
          </>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"
          >
            {notice}
          </div>
        )}
      </main>

      <footer className="py-5 text-center text-sm font-semibold text-slate-500">
        @almassira2026
      </footer>
    </div>
  );
}

export default function Portal() {
  return (
    <SessionProvider>
      <App />
    </SessionProvider>
  );
}
