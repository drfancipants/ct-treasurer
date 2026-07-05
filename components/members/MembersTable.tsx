'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateMemberRole, removeMember } from '@/actions/members'
import { UserPlus, Users, MoreHorizontal, Trash2, UserCog, Pencil, Send, Phone, Mail, XCircle } from 'lucide-react'
import type { CommitteeMember, MemberRole } from '@/lib/types'
import { ROLE_LABELS, ROLE_ORDER } from '@/lib/types'
import { formatDate, getInitials, cn } from '@/lib/utils'
import AddMemberDialog from './AddMemberDialog'
import EditMemberDialog from './EditMemberDialog'
import ResendInviteDialog from './ResendInviteDialog'

const ROLE_COLORS: Record<MemberRole, string> = {
  TREASURER: 'bg-blue-50 text-blue-700 ring-blue-200',
  ASSISTANT_TREASURER: 'bg-teal-50 text-teal-700 ring-teal-200',
  CHAIRPERSON: 'bg-violet-50 text-violet-700 ring-violet-200',
  SECRETARY: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  MEMBER: 'bg-slate-100 text-slate-600 ring-slate-200',
  VIEWER: 'bg-slate-50 text-slate-500 ring-slate-150',
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
]

interface Props {
  members: CommitteeMember[]
  committeeId: string
  committeeSlug: string
  committeeName: string
}

export default function MembersTable({ members: initial, committeeId, committeeSlug, committeeName }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<CommitteeMember | null>(null)
  const [resending, setResending] = useState<CommitteeMember | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [error, setError] = useState('')

  // The dropdown uses position: fixed (not absolute) so it isn't clipped by
  // the table's horizontal-scroll wrapper — a container can't scroll on one
  // axis while leaving the other axis unclipped for absolutely-positioned
  // descendants, so this reads the trigger's on-screen position instead.
  function toggleMenu(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (openMenu === id) {
      setOpenMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpenMenu(id)
  }

  const sorted = [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
  )

  function handleEditSave(member: CommitteeMember) {
    setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)))
    setEditing(null)
  }

  // AddMemberDialog stays open through its own confirmation step (the
  // invite-link screen) — it calls onClose itself once the user is done, so
  // closing it here too would skip straight past that screen.
  function handleAdd(member: CommitteeMember) {
    setMembers((prev) => [...prev, member])
  }

  async function handleRemove(id: string) {
    const snapshot = members
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setOpenMenu(null)
    try {
      await removeMember(id, committeeSlug)
    } catch (err) {
      setMembers(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  async function handleRoleChange(id: string, role: MemberRole) {
    const snapshot = members
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
    setOpenMenu(null)
    try {
      await updateMemberRole(id, role, committeeSlug)
    } catch (err) {
      setMembers(snapshot)
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  return (
    <>
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {members.length} {members.length === 1 ? 'person' : 'people'} with committee access
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add member
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">
                Joined
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((member, idx) => (
              <tr key={member.id} className="table-row-hover">
                {/* Avatar + Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                        AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      )}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                        {member.name}
                        {member.pendingInvite && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                            Pending
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 hidden sm:block">{member.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role badge */}
                <td className="px-4 py-3.5">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ring-1',
                      ROLE_COLORS[member.role]
                    )}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </td>

                {/* Contact */}
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <div className="flex flex-col gap-0.5">
                    {member.email && (
                      <a
                        href={`mailto:${member.email}`}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </a>
                    )}
                    {member.phone && (
                      <a
                        href={`tel:${member.phone}`}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        {member.phone}
                      </a>
                    )}
                  </div>
                </td>

                {/* Joined */}
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-xs text-slate-500">{formatDate(member.joinedAt)}</span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5 relative">
                  <button
                    onClick={(e) => toggleMenu(member.id, e)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Member actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {openMenu === member.id && menuPos && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div
                        className="fixed z-20 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                        style={{ top: menuPos.top, right: menuPos.right }}
                      >
                        <div className="border-b border-slate-100">
                          <button
                            onClick={() => { setEditing(member); setOpenMenu(null) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit member
                          </button>
                          {member.pendingInvite && (
                            <button
                              onClick={() => { setResending(member); setOpenMenu(null) }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Resend invite
                            </button>
                          )}
                        </div>
                        <div className="px-3 py-2 border-b border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Change role
                          </p>
                        </div>
                        {(Object.keys(ROLE_LABELS) as MemberRole[]).map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(member.id, role)}
                            className={cn(
                              'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors',
                              member.role === role ? 'text-blue-600 font-medium' : 'text-slate-700'
                            )}
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            {ROLE_LABELS[role]}
                          </button>
                        ))}
                        <div className="border-t border-slate-100">
                          <button
                            onClick={() => handleRemove(member.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove member
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {members.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No members yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Add the first member →
            </button>
          </div>
        )}
      </div>

      <AddMemberDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
        committeeId={committeeId}
        committeeName={committeeName}
      />

      {editing && (
        <EditMemberDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          onSave={handleEditSave}
          committeeSlug={committeeSlug}
          member={editing}
        />
      )}

      {resending && (
        <ResendInviteDialog
          key={resending.id}
          open
          onClose={() => setResending(null)}
          committeeId={committeeId}
          committeeName={committeeName}
          member={resending}
        />
      )}
    </>
  )
}
