import React, { Fragment, useState, useEffect, useContext } from 'react'
import './index.css'
import SettingsContext from '../../SettingsContext'
import { executeWorkaround, listWorkarounds } from 'frontend/helpers'

function Workarounds() {
  const { appName, runner } = useContext(SettingsContext)
  const [jsons, setjsons] = useState(null)

  useEffect(() => {
    const getjsons = async () => {
      const test = await listWorkarounds(appName, runner)
      if (test) {
        setjsons(test)
      }
    }
    getjsons()
  }, [])
  if (!jsons) {
    return (
      <>
        <h3 className="settingSubheader">Workarounds</h3>
        No workarounds were found in this folder
      </>
    )
  }

  return (
    <>
      <h3 className="settingSubheader">Workarounds</h3>
      <table>
        <tbody>
          <tr>
            <th></th>
            <th></th>
            <th></th>
          </tr>
          {jsons.map((json) => (
            <Fragment key={json.name}>
              <tr>
                <td key={json.name}>{json.name}</td>
                <td>
                  <button
                    disabled={json.executed}
                    onClick={async () => {
                      await executeWorkaround(appName, runner, json.name, false)
                    }}
                  >
                    Apply
                  </button>
                </td>
                <td>
                  <button
                    onClick={async () => {
                      await executeWorkaround(appName, runner, json.name, true)
                    }}
                  >
                    Force Apply
                  </button>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  )
}

export default Workarounds
