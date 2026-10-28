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
