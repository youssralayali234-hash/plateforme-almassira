
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  {(edit.image_urls || []).map((url: string, i: number) => (
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
                    (_: string, j: number) => j !== i
                  )
                }
              : null
          )
        }
      >
        Retirer
      </button>
    </div>
  ))}
</div>
