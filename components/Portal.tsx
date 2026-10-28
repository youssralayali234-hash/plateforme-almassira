
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
