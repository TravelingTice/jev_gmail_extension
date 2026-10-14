import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  categoryColor,
  validateCategoryDraft,
  newCategoryId,
} from '../../domain/categories'
import { EXTENSION_NAME } from '../../shared/limits'
import type { Settings } from '../../shared/schemas'
import type { Category } from '../../domain/types'
import '../styles/app.css'
import logoUrl from '../../../assets/brand/logo-ui.png?inline'
import { loadBrandFont } from '../../shared/brand-font'

loadBrandFont()

type Snapshot = {
  ok: boolean
  error?: string
  settings?: Settings
  hasKey?: boolean
  keySuffix?: string | null
}

const call = <T,>(message: unknown): Promise<T> =>
  chrome.runtime.sendMessage(message) as Promise<T>

const CategoryRow = ({
  category,
  categories,
  onSave,
  onColor,
  onDelete,
}: {
  category: Category
  categories: Category[]
  onSave: (id: string, patch: { name: string; description: string }) => void
  onColor: (id: string, color: string) => void
  onDelete: (id: string) => void
}) => {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description)
  const [error, setError] = useState('')
  const focused = useRef(false)

  useEffect(() => {
    if (focused.current) return
    setName(category.name)
    setDescription(category.description)
  }, [category.name, category.description])

  const commit = (nextName: string, nextDescription: string) => {
    const validated = validateCategoryDraft(
      { name: nextName, description: nextDescription },
      categories,
      category.id,
    )
    if (!validated.ok) {
      setError(validated.error)
      return
    }
    setName(validated.name)
    setDescription(validated.description)
    setError(validated.warning ?? '')
    if (
      validated.name === category.name &&
      validated.description === category.description
    ) {
      return
    }
    onSave(category.id, {
      name: validated.name,
      description: validated.description,
    })
  }

  return (
    <li className="gec-category">
      <input
        type="color"
        aria-label={`Color for ${category.name}`}
        value={category.color}
        onChange={(event) => onColor(category.id, event.target.value)}
      />
      <div>
        <label>
          Name
          <input
            type="text"
            data-testid={`edit-name-${category.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={() => {
              focused.current = true
            }}
            onBlur={(event) => {
              focused.current = false
              commit(event.target.value, description)
            }}
          />
        </label>
        <label>
          Classifier description
          <textarea
            data-testid={`edit-description-${category.id}`}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onFocus={() => {
              focused.current = true
            }}
            onBlur={(event) => {
              focused.current = false
              commit(name, event.target.value)
            }}
          />
        </label>
        {error ? <p className="gec-warning">{error}</p> : null}
      </div>
      <button type="button" onClick={() => onDelete(category.id)}>
        Delete
      </button>
    </li>
  )
}

const Options = () => {
  const [state, setState] = useState<Snapshot | null>(null)
  const [key, setKey] = useState('')
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(categoryColor(0))
  const settings = state?.settings

  const refresh = async (): Promise<void> => {
    setState(await call<Snapshot>({ type: 'getSettings' }))
  }

  useEffect(() => {
    void refresh()
  }, [])

  const saveChain = useRef(Promise.resolve())
  const latest = useRef<Settings | null>(null)
  if (settings && !latest.current) latest.current = settings
  const save = (
    patch:
      | Record<string, unknown>
      | ((current: Settings) => Record<string, unknown>),
  ): Promise<void> => {
    const run = saveChain.current.then(async () => {
      const current = latest.current
      if (!current) return
      const resolved = typeof patch === 'function' ? patch(current) : patch
      const next = { ...current, ...resolved } as Settings
      latest.current = next
      setState((snapshot) =>
        snapshot ? { ...snapshot, settings: next } : snapshot,
      )
      const result = await call<Snapshot>({
        type: 'saveSettings',
        patch: resolved,
      })
      if (!result.ok) {
        latest.current = current
        setState((snapshot) =>
          snapshot ? { ...snapshot, settings: current } : snapshot,
        )
        setNotice(result.error ?? 'Could not save settings.')
        return
      }
      setNotice('')
      if (result.settings) latest.current = result.settings
      setState(result)
    })
    saveChain.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  if (!settings)
    return <main className="gec-options">Loading {EXTENSION_NAME}…</main>

  const classifying = settings.enabled && !settings.paused

  return (
    <main className="gec-options">
      <div className="gec-wrap">
        <header className="gec-brand">
          <img src={logoUrl} alt="" />
          <div>
            <h1>{EXTENSION_NAME}</h1>
            <p>Labels on the loaded Gmail list. These are not Gmail labels.</p>
          </div>
        </header>

        <section className="gec-section gec-enable">
          <div>
            <h2>{classifying ? 'Enabled' : 'Off'}</h2>
            <p className="gec-meta">
              When this is on, sender, subject, preview, and date are sent to
              TypeSafe. Message bodies stay in Gmail.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            className="gec-switch-control"
            aria-checked={classifying}
            aria-label={EXTENSION_NAME}
            data-testid="enable"
            onClick={() => {
              const enabled = !classifying
              void save({
                enabled,
                paused: false,
                disclosureAcknowledged:
                  enabled || settings.disclosureAcknowledged,
              })
            }}
          >
            <span className="gec-switch-knob" />
          </button>
        </section>
        {notice ? <p className="gec-warning">{notice}</p> : null}

        <section className="gec-section">
          <h2>Help improve GmailClass</h2>
          <label>
            <input
              type="checkbox"
              checked={settings.analyticsEnabled}
              onChange={(event) => {
                void save({ analyticsEnabled: event.target.checked })
              }}
            />
            Share anonymous usage events (optional)
          </label>
          <p className="gec-meta">
            Off by default. Sends only fixed events for analytics opt-in,
            enabling classification, adding a category, and using labels (at
            most once a day). No email data, category names or descriptions, API
            keys, account details, or device identifiers are sent. Disable this
            any time to stop collection. Requests go to GmailClass on Vercel;
            daily totals are stored in Neon for 400 days. Hosting providers may
            retain ordinary connection logs such as IP addresses.{' '}
            <a
              href="https://gmailclass.ticekralt.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Privacy policy
            </a>
          </p>
        </section>

        <section className="gec-section">
          <h2>TypeSafe API key</h2>
          <p>
            The key stays in extension storage on this browser. That storage is
            not a hardware-backed vault.
          </p>
          <label>
            API key
            <input
              data-testid="api-key"
              type="password"
              value={key}
              autoComplete="off"
              onChange={(event) => setKey(event.target.value)}
            />
          </label>
          <div className="gec-row">
            <button
              type="button"
              data-testid="save-key"
              onClick={() => {
                void call<Snapshot>({ type: 'saveKey', apiKey: key }).then(
                  (result) => {
                    setKey('')
                    setState(result)
                    setNotice(
                      result.ok
                        ? 'Key saved.'
                        : (result.error ?? 'Could not save the key.'),
                    )
                  },
                )
              }}
            >
              Save key
            </button>
            <button
              type="button"
              data-testid="remove-key"
              onClick={() =>
                void call<Snapshot>({ type: 'removeKey' }).then(setState)
              }
            >
              Remove API key
            </button>
            <span data-testid="key-suffix">
              {state?.hasKey
                ? `Key saved, ends in ${state.keySuffix}`
                : 'No key saved'}
            </span>
          </div>
        </section>

        <section className="gec-section">
          <h2>Categories</h2>
          <p className="gec-meta">
            The description is what the classifier uses to decide whether an
            email belongs in that category. Changing it reclassifies loaded
            mail.
          </p>
          <ul className="gec-category-list" data-testid="category-list">
            {settings.categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                categories={settings.categories}
                onSave={(id, patch) =>
                  void save((current) => ({
                    categories: current.categories.map((item) =>
                      item.id === id ? { ...item, ...patch } : item,
                    ),
                  }))
                }
                onColor={(id, color) =>
                  void save((current) => ({
                    categories: current.categories.map((item) =>
                      item.id === id ? { ...item, color } : item,
                    ),
                  }))
                }
                onDelete={(id) =>
                  void save((current) => ({
                    categories: current.categories.filter(
                      (item) => item.id !== id,
                    ),
                  }))
                }
              />
            ))}
          </ul>
          <label>
            Name
            <input
              type="text"
              data-testid="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              data-testid="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Color
            <input
              type="color"
              aria-label="Color for the new category"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <p className="gec-warning">{warning}</p>
          <button
            type="button"
            data-testid="add-category"
            onClick={() => {
              const validated = validateCategoryDraft(
                { name, description },
                settings.categories,
              )
              if (!validated.ok) {
                setWarning(validated.error)
                return
              }
              setWarning(validated.warning ?? '')
              void save((current) => ({
                categories: [
                  ...current.categories,
                  {
                    id: newCategoryId(Date.now(), Math.random),
                    name: validated.name,
                    description: validated.description,
                    enabled: true,
                    color,
                  },
                ],
              }))
              setName('')
              setDescription('')
              setColor(categoryColor(settings.categories.length + 1))
            }}
          >
            Add category
          </button>
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Options />)
