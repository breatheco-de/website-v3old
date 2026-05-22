import { useState, useEffect } from "react";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconCode,
  IconInfoCircle,
  IconLanguage,
  IconLoader2,
  IconPlus,
  IconStar,
  IconTrash,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconAlertCircle,
  IconShield,
  IconUsers,
  IconPencil,
  IconX,
  IconUserPlus,
  IconUserCheck,
  IconPhoto,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { ImagePickerDialog } from "@/components/editing/ImagePickerDialog";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDebugAuth, getDebugUserName } from "@/hooks/useDebugAuth";
import { CAPABILITY_REGISTRY } from "@shared/capabilities";

interface LocaleEntry {
  code: string;
  label: string;
}

interface LocaleSettings {
  default_locale: string;
  supported_locales: LocaleEntry[];
}

interface Migration {
  filename: string;
  name: string;
  description: string;
}

interface MigrationRowState {
  running: boolean;
  result: { success: boolean; output: string } | null;
}

interface CapabilityGrant {
  name: string;
  contentTypes?: string[] | "*";
}

interface RoleDefinition {
  label: string;
  description?: string;
  capabilities: CapabilityGrant[];
}

interface UserRecord {
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  lastLoginAt?: string;
  roles: string[];
}

interface PendingUserRecord {
  email: string;
  role: string;
  createdAt: string;
}

interface CapabilityFormState { enabled: boolean; contentTypes: string; }
interface RoleFormState {
  id: string;
  label: string;
  description: string;
  capabilities: Record<string, CapabilityFormState>;
}

interface ContentTypeEntry {
  name: string;
  label: string;
}

function ContentTypeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: contentTypesData } = useQuery<ContentTypeEntry[]>({
    queryKey: ["/api/content-types"],
  });

  const contentTypes = contentTypesData ?? [];
  const selected = value.trim()
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const isAll = selected.length === 0;

  function toggleAll() {
    onChange("");
  }

  function toggleType(name: string) {
    if (isAll) {
      onChange(name);
    } else if (selected.includes(name)) {
      const next = selected.filter((t) => t !== name);
      onChange(next.join(", "));
    } else {
      onChange([...selected, name].join(", "));
    }
  }

  const displayLabel = isAll
    ? "All content types"
    : selected.length === 1
    ? (contentTypes.find((ct) => ct.name === selected[0])?.label ?? selected[0])
    : `${selected.length} content types`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 justify-between w-full font-normal"
          data-testid="button-ct-selector"
        >
          <span className="truncate">{displayLabel}</span>
          <IconChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-64" align="start">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 px-1 py-1 rounded-sm hover-elevate cursor-pointer">
            <Checkbox
              checked={isAll}
              onCheckedChange={toggleAll}
              id="ct-all"
              data-testid="checkbox-ct-all"
            />
            <label htmlFor="ct-all" className="text-xs cursor-pointer font-medium flex-1">
              All content types
            </label>
          </div>
          {contentTypes.length > 0 && <div className="border-t my-1" />}
          {contentTypes.map((ct) => (
            <div
              key={ct.name}
              className="flex items-center gap-2 px-1 py-1 rounded-sm hover-elevate cursor-pointer"
            >
              <Checkbox
                checked={!isAll && selected.includes(ct.name)}
                onCheckedChange={() => toggleType(ct.name)}
                id={`ct-${ct.name}`}
                data-testid={`checkbox-ct-${ct.name}`}
              />
              <label htmlFor={`ct-${ct.name}`} className="text-xs cursor-pointer flex-1 min-w-0">
                <span className="block truncate">{ct.label}</span>
                <span className="block text-muted-foreground font-mono">{ct.name}</span>
              </label>
            </div>
          ))}
          {contentTypes.length === 0 && (
            <p className="text-xs text-muted-foreground px-1 py-1">Loading content types…</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function capGrantsFromFormState(map: Record<string, CapabilityFormState>): CapabilityGrant[] {
  return Object.entries(map)
    .filter(([, v]) => v.enabled)
    .map(([name, v]) => ({
      name,
      contentTypes: v.contentTypes.trim()
        ? (v.contentTypes.split(",").map((s) => s.trim()).filter(Boolean) as string[])
        : ("*" as "*"),
    }));
}

function capMapFromGrants(grants: CapabilityGrant[]): Record<string, CapabilityFormState> {
  const map: Record<string, CapabilityFormState> = {};
  for (const cap of grants) {
    map[cap.name] = {
      enabled: true,
      contentTypes: Array.isArray(cap.contentTypes) ? cap.contentTypes.join(", ") : "",
    };
  }
  return map;
}

function CapabilityFields({
  caps,
  onChange,
}: {
  caps: Record<string, CapabilityFormState>;
  onChange: (updated: Record<string, CapabilityFormState>) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
      {CAPABILITY_REGISTRY.map((cap) => {
        const state = caps[cap.name] ?? { enabled: false, contentTypes: "" };
        return (
          <div key={cap.name} className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`cap-${cap.name}`}
                checked={state.enabled}
                onCheckedChange={(checked) =>
                  onChange({ ...caps, [cap.name]: { ...state, enabled: !!checked } })
                }
                data-testid={`checkbox-cap-${cap.name}`}
              />
              <div className="flex-1 min-w-0">
                <label htmlFor={`cap-${cap.name}`} className="text-xs cursor-pointer">
                  {cap.label}
                </label>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {cap.description}
                </p>
              </div>
              {cap.scoped && (
                <span className="text-xs text-muted-foreground shrink-0">scopeable</span>
              )}
            </div>
            {cap.scoped && state.enabled && (
              <div className="ml-6">
                <ContentTypeSelector
                  value={state.contentTypes}
                  onChange={(v) =>
                    onChange({ ...caps, [cap.name]: { ...state, contentTypes: v } })
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RolesTab() {
  const { toast } = useToast();
  const { isValidated } = useDebugAuth();
  const { data: rolesData, isLoading } = useQuery<Record<string, RoleDefinition>>({
    queryKey: ["/api/admin/roles"],
    enabled: isValidated === true,
  });

  const [newRoleForm, setNewRoleForm] = useState<RoleFormState | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleForm, setEditRoleForm] = useState<Omit<RoleFormState, "id"> | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const roles = rolesData ? Object.entries(rolesData) : [];

  function startNewRole() {
    setNewRoleForm({ id: "", label: "", description: "", capabilities: {} });
    setEditingRoleId(null);
    setEditRoleForm(null);
  }

  function startEditRole(roleId: string, role: RoleDefinition) {
    setEditingRoleId(roleId);
    setEditRoleForm({
      label: role.label,
      description: role.description || "",
      capabilities: capMapFromGrants(role.capabilities),
    });
    setNewRoleForm(null);
  }

  async function saveNewRole() {
    if (!newRoleForm) return;
    if (!newRoleForm.id || !newRoleForm.label) {
      toast({ title: "Required fields missing", description: "Role ID and label are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/admin/roles", {
        id: newRoleForm.id,
        label: newRoleForm.label,
        description: newRoleForm.description || undefined,
        capabilities: capGrantsFromFormState(newRoleForm.capabilities),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save role");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setNewRoleForm(null);
      toast({ title: "Role created" });
    } catch (err: any) {
      toast({ title: "Failed to save role", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveEditRole() {
    if (!editingRoleId || !editRoleForm) return;
    if (!editRoleForm.label) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("PUT", `/api/admin/roles/${editingRoleId}`, {
        label: editRoleForm.label,
        description: editRoleForm.description || undefined,
        capabilities: capGrantsFromFormState(editRoleForm.capabilities),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update role");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setEditingRoleId(null);
      setEditRoleForm(null);
      toast({ title: "Role updated" });
    } catch (err: any) {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRole(roleId: string) {
    try {
      const res = await apiRequest("DELETE", `/api/admin/roles/${roleId}`, undefined);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete role");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      setDeletingRoleId(null);
      toast({ title: "Role deleted" });
    } catch (err: any) {
      setDeletingRoleId(null);
      toast({ title: "Failed to delete role", description: err.message, variant: "destructive" });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define roles and assign capabilities to them.</p>
        <Button variant="outline" size="sm" onClick={startNewRole} data-testid="button-new-role">
          <IconPlus className="h-4 w-4 mr-1.5" />
          New role
        </Button>
      </div>

      {newRoleForm && (
        <Card data-testid="card-new-role">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-sm font-medium">New role</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setNewRoleForm(null)}>
              <IconX className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">ID</label>
                <Input
                  placeholder="editor"
                  value={newRoleForm.id}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                  data-testid="input-new-role-id"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Label</label>
                <Input
                  placeholder="Content Editor"
                  value={newRoleForm.label}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, label: e.target.value })}
                  data-testid="input-new-role-label"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Input
                placeholder="Can edit text content"
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                data-testid="input-new-role-description"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Capabilities</label>
              <CapabilityFields
                caps={newRoleForm.capabilities}
                onChange={(updated) => setNewRoleForm({ ...newRoleForm, capabilities: updated })}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveNewRole} disabled={saving} data-testid="button-save-new-role">
                {saving ? <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-1.5" />}
                Save role
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {roles.length === 0 && !newRoleForm && (
          <p className="text-sm text-muted-foreground text-center py-8">No roles defined yet.</p>
        )}
        {roles.map(([roleId, role]) => {
          const isBuiltIn = roleId === "webmaster";
          const isEditing = editingRoleId === roleId;
          const isDeleting = deletingRoleId === roleId;
          return (
            <Card key={roleId} data-testid={`card-role-${roleId}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <code className="text-xs font-mono text-muted-foreground shrink-0">{roleId}</code>
                  {isEditing && editRoleForm ? (
                    <Input
                      value={editRoleForm.label}
                      onChange={(e) => setEditRoleForm({ ...editRoleForm, label: e.target.value })}
                      className="text-sm font-medium h-7"
                      data-testid={`input-edit-role-label-${roleId}`}
                    />
                  ) : (
                    <span className="text-sm font-medium truncate">{role.label}</span>
                  )}
                  {isBuiltIn && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs shrink-0 cursor-default gap-1" data-testid="badge-role-managed-by-code">
                          <IconCode className="h-3 w-3" />
                          managed by code
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-center">
                        This role is defined in source code and synced on every server start. Any manual edits will be overwritten automatically.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isBuiltIn && !isEditing && !isDeleting && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditRole(roleId, role)}
                        data-testid={`button-edit-role-${roleId}`}
                      >
                        <IconPencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingRoleId(roleId)}
                        data-testid={`button-delete-role-${roleId}`}
                      >
                        <IconTrash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <Button
                        size="sm"
                        onClick={saveEditRole}
                        disabled={saving}
                        data-testid={`button-save-edit-role-${roleId}`}
                      >
                        {saving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingRoleId(null); setEditRoleForm(null); }}
                        data-testid={`button-cancel-edit-role-${roleId}`}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isDeleting ? (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-sm text-muted-foreground flex-1">
                      Delete "{role.label}"? This cannot be undone.
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => confirmDeleteRole(roleId)}
                      data-testid={`button-confirm-delete-role-${roleId}`}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingRoleId(null)}
                      data-testid={`button-cancel-delete-role-${roleId}`}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : isEditing && editRoleForm ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                      <Input
                        placeholder="Role description"
                        value={editRoleForm.description}
                        onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                        data-testid={`input-edit-role-desc-${roleId}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Capabilities</label>
                      <CapabilityFields
                        caps={editRoleForm.capabilities}
                        onChange={(updated) => setEditRoleForm({ ...editRoleForm, capabilities: updated })}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mb-2">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {role.capabilities.map((cap) => (
                        <Badge key={cap.name} variant="outline" className="text-xs font-mono">
                          {cap.name}
                          {Array.isArray(cap.contentTypes) && cap.contentTypes.length > 0 && (
                            <span className="text-muted-foreground ml-1">({cap.contentTypes.join(",")})</span>
                          )}
                        </Badge>
                      ))}
                      {role.capabilities.length === 0 && (
                        <span className="text-xs text-muted-foreground">No capabilities assigned</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const { isValidated } = useDebugAuth();
  const { data: users, isLoading: usersLoading } = useQuery<UserRecord[]>({
    queryKey: ["/api/admin/users"],
    enabled: isValidated === true,
  });
  const { data: pendingUsers, isLoading: pendingLoading } = useQuery<PendingUserRecord[]>({
    queryKey: ["/api/admin/pending-users"],
    enabled: isValidated === true,
  });
  const { data: rolesData } = useQuery<Record<string, RoleDefinition>>({
    queryKey: ["/api/admin/roles"],
    enabled: isValidated === true,
  });

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState<string>("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  const [deletingPendingEmail, setDeletingPendingEmail] = useState<string | null>(null);
  const [assigningEmail, setAssigningEmail] = useState<string | null>(null);
  const [assignTargetUsername, setAssignTargetUsername] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  const allRoles = rolesData ? Object.entries(rolesData) : [];
  const allUsers = users ?? [];

  function startEditRoles(user: UserRecord) {
    setEditingUser(user.username);
    setEditingUsername(user.username);
    setUserRoles([...user.roles]);
  }

  async function saveUserRoles(originalUsername: string) {
    const trimmedUsername = editingUsername.trim();
    if (!trimmedUsername) {
      toast({ title: "Username cannot be empty", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let activeUsername = originalUsername;
      if (trimmedUsername !== originalUsername) {
        const renameRes = await apiRequest("PATCH", `/api/admin/users/${originalUsername}`, { username: trimmedUsername });
        if (!renameRes.ok) {
          const err = await renameRes.json();
          throw new Error(err.error || "Failed to rename user");
        }
        activeUsername = trimmedUsername;
      }
      const rolesRes = await apiRequest("PUT", `/api/admin/users/${activeUsername}/roles`, { roles: userRoles });
      if (!rolesRes.ok) {
        const err = await rolesRes.json();
        throw new Error(err.error || "Failed to update roles");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({ title: "User updated" });
    } catch (err: any) {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPendingUser() {
    if (!newEmail.trim() || !newRole) {
      toast({ title: "Email and role are required", variant: "destructive" });
      return;
    }
    setAddingSaving(true);
    try {
      const res = await apiRequest("POST", "/api/admin/pending-users", { email: newEmail.trim(), role: newRole });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add user");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      setShowAddForm(false);
      setNewEmail("");
      setNewRole("");
      toast({ title: "User pre-registered", description: `${newEmail.trim()} will receive the role on next login.` });
    } catch (err: any) {
      toast({ title: "Failed to add user", description: err.message, variant: "destructive" });
    } finally {
      setAddingSaving(false);
    }
  }

  async function handleDeletePending(email: string) {
    try {
      const res = await apiRequest("DELETE", `/api/admin/pending-users/${encodeURIComponent(email)}`, undefined);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove pending user");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      setDeletingPendingEmail(null);
      toast({ title: "Pending user removed" });
    } catch (err: any) {
      setDeletingPendingEmail(null);
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    }
  }

  async function handleAssignPending() {
    if (!assigningEmail || !assignTargetUsername) return;
    setAssignSaving(true);
    try {
      const res = await apiRequest("POST", `/api/admin/pending-users/${encodeURIComponent(assigningEmail)}/assign`, { username: assignTargetUsername });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setAssigningEmail(null);
      setAssignTargetUsername("");
      toast({ title: "Role assigned", description: `User "${assignTargetUsername}" has been granted the role.` });
    } catch (err: any) {
      toast({ title: "Failed to assign", description: err.message, variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  }

  if (usersLoading || pendingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = pendingUsers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Manage users and pre-register people by email before they log in.</p>
        <Button variant="outline" size="sm" onClick={() => { setShowAddForm(true); setAssigningEmail(null); setDeletingPendingEmail(null); }} data-testid="button-add-user">
          <IconUserPlus className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
      </div>

      {showAddForm && (
        <Card data-testid="card-add-pending-user">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-sm font-medium">Pre-register user</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}>
              <IconX className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">No email will be sent.</span> The user receives no notification of this entry.</p>
              <p>Access is granted automatically when they log in via Breathecode and their account email matches the one entered here.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email address</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPendingUser(); }}
                data-testid="input-pending-email"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                data-testid="select-pending-role"
              >
                <option value="">Select a role…</option>
                {allRoles.map(([roleId, role]) => (
                  <option key={roleId} value={roleId}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleAddPendingUser} disabled={addingSaving} data-testid="button-save-pending-user">
                {addingSaving ? <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-1.5" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</p>
          {pending.map((p) => {
            const isDeleting = deletingPendingEmail === p.email;
            const isAssigning = assigningEmail === p.email;
            return (
              <Card key={p.email} data-testid={`card-pending-${p.email}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{p.email}</span>
                      <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Role:</span>
                      <Badge variant="secondary" className="text-xs">{rolesData?.[p.role]?.label || p.role}</Badge>
                    </div>
                  </div>
                  {!isDeleting && !isAssigning && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Assign to existing user"
                        onClick={() => { setAssigningEmail(p.email); setAssignTargetUsername(""); setDeletingPendingEmail(null); }}
                        data-testid={`button-assign-pending-${p.email}`}
                      >
                        <IconUserCheck className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingPendingEmail(p.email); setAssigningEmail(null); }}
                        data-testid={`button-delete-pending-${p.email}`}
                      >
                        <IconTrash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                {(isDeleting || isAssigning) && (
                  <CardContent className="pt-0">
                    {isDeleting && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-sm text-muted-foreground flex-1">Remove this pending entry?</span>
                        <Button size="sm" variant="destructive" onClick={() => handleDeletePending(p.email)} data-testid={`button-confirm-delete-pending-${p.email}`}>Remove</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeletingPendingEmail(null)} data-testid={`button-cancel-delete-pending-${p.email}`}>Cancel</Button>
                      </div>
                    )}
                    {isAssigning && (
                      <div className="space-y-2 py-1">
                        <p className="text-xs text-muted-foreground">Assign this pre-registration to an existing user, bypassing the email match.</p>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                            value={assignTargetUsername}
                            onChange={(e) => setAssignTargetUsername(e.target.value)}
                            data-testid={`select-assign-user-${p.email}`}
                          >
                            <option value="">Select a user…</option>
                            {allUsers.map((u) => (
                              <option key={u.username} value={u.username}>
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username} ({u.username})
                              </option>
                            ))}
                          </select>
                          <Button size="sm" onClick={handleAssignPending} disabled={!assignTargetUsername || assignSaving} data-testid={`button-confirm-assign-${p.email}`}>
                            {assignSaving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAssigningEmail(null)} data-testid={`button-cancel-assign-${p.email}`}>
                            <IconX className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {allUsers.length > 0 && (
        <div className="space-y-2">
          {pending.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>}
          {allUsers.map((user) => (
            <Card key={user.username} data-testid={`card-user-${user.username}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
                    </span>
                    <code className="text-xs font-mono text-muted-foreground">{user.username}</code>
                  </div>
                  {user.email && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}
                </div>
                {editingUser === user.username ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => saveUserRoles(user.username)}
                      disabled={saving}
                      data-testid={`button-save-user-roles-${user.username}`}
                    >
                      {saving ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingUser(null)}
                      data-testid={`button-cancel-user-${user.username}`}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEditRoles(user)}
                    data-testid={`button-edit-user-${user.username}`}
                  >
                    <IconPencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {editingUser === user.username ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={`username-input-${user.username}`}>
                        Username
                      </label>
                      <Input
                        id={`username-input-${user.username}`}
                        value={editingUsername}
                        onChange={(e) => setEditingUsername(e.target.value)}
                        disabled={user.username === getDebugUserName()}
                        placeholder="Username"
                        required
                        data-testid={`input-username-${user.username}`}
                      />
                      {user.username === getDebugUserName() && (
                        <p className="text-xs text-muted-foreground">Cannot rename your own account</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                    {allRoles.map(([roleId, role]) => (
                      <div key={roleId} className="flex items-center gap-2">
                        <Checkbox
                          id={`user-role-${user.username}-${roleId}`}
                          checked={userRoles.includes(roleId)}
                          onCheckedChange={(checked) =>
                            setUserRoles(checked
                              ? [...userRoles, roleId]
                              : userRoles.filter((r) => r !== roleId))
                          }
                          data-testid={`checkbox-user-role-${user.username}-${roleId}`}
                        />
                        <label htmlFor={`user-role-${user.username}-${roleId}`} className="text-xs cursor-pointer">
                          {role.label}
                        </label>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No roles assigned</span>
                    ) : (
                      user.roles.map((roleId) => (
                        <Badge key={roleId} variant="secondary" className="text-xs">
                          {rolesData?.[roleId]?.label || roleId}
                        </Badge>
                      ))
                    )}
                    {user.lastLoginAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Last login: {new Date(user.lastLoginAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {allUsers.length === 0 && pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <IconAlertCircle className="h-8 w-8" />
          <p className="text-sm">No users yet. Pre-register users above, or wait for someone to log in.</p>
        </div>
      )}
    </div>
  );
}

interface BrandSettings {
  default_social_image: string;
  twitter_handle: string;
  linkedin: string;
  facebook: string;
  youtube: string;
  instagram: string;
  github: string;
  unknown_same_as: string[];
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { hasCapability, isValidated } = useDebugAuth();
  const { data, isLoading } = useQuery<LocaleSettings>({
    queryKey: ["/api/settings/locales"],
  });

  const { data: migrations, isLoading: migrationsLoading } = useQuery<Migration[]>({
    queryKey: ["/api/migrations"],
  });

  const { data: brandData, isLoading: brandLoading } = useQuery<BrandSettings>({
    queryKey: ["/api/admin/brand-settings"],
    enabled: isValidated === true,
  });

  const [locales, setLocales] = useState<LocaleEntry[]>([]);
  const [defaultLocale, setDefaultLocale] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [migrationStates, setMigrationStates] = useState<Record<string, MigrationRowState>>({});
  const [brandImagePickerOpen, setBrandImagePickerOpen] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [twitterHandle, setTwitterHandle] = useState("");
  const [twitterSaving, setTwitterSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ linkedin: "", facebook: "", youtube: "", instagram: "", github: "" });
  const [socialSaving, setSocialSaving] = useState<string | null>(null);
  const [socialErrors, setSocialErrors] = useState<Record<string, string | null>>({});

  const SOCIAL_DOMAINS: Record<string, string> = {
    linkedin: "linkedin.com",
    facebook: "facebook.com",
    youtube: "youtube.com",
    instagram: "instagram.com",
    github: "github.com",
  };

  function validateSocialUrl(key: string, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return "Not a valid URL — make sure it starts with https://";
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "URL must start with https://";
    }
    const expectedDomain = SOCIAL_DOMAINS[key];
    if (expectedDomain && !parsed.hostname.endsWith(expectedDomain)) {
      return `This doesn't look like a ${key.charAt(0).toUpperCase() + key.slice(1)} URL (expected ${expectedDomain})`;
    }
    return null;
  }

  const canManageUsers = hasCapability("users_manage");
  const canEditSeo = hasCapability("seo_edit");

  useEffect(() => {
    if (data) {
      setLocales(data.supported_locales.map((l) => ({ ...l })));
      setDefaultLocale(data.default_locale);
      setDirty(false);
    }
  }, [data]);

  useEffect(() => {
    if (brandData) {
      setTwitterHandle(brandData.twitter_handle ?? "");
      setSocialLinks({
        linkedin: brandData.linkedin ?? "",
        facebook: brandData.facebook ?? "",
        youtube: brandData.youtube ?? "",
        instagram: brandData.instagram ?? "",
        github: brandData.github ?? "",
      });
    }
  }, [brandData]);

  function addLocale() {
    const code = newCode.trim().toLowerCase();
    const label = newLabel.trim();
    if (!code || !label) return;
    if (!/^[a-z]{2,3}$/.test(code)) {
      toast({ title: "Invalid code", description: "Locale code must be 2-3 lowercase letters", variant: "destructive" });
      return;
    }
    if (locales.some((l) => l.code === code)) {
      toast({ title: "Duplicate", description: `Locale "${code}" already exists`, variant: "destructive" });
      return;
    }
    setLocales((prev) => [...prev, { code, label }]);
    setNewCode("");
    setNewLabel("");
    setDirty(true);
  }

  function removeLocale(code: string) {
    if (locales.length <= 1) return;
    if (code === defaultLocale) {
      toast({ title: "Cannot remove", description: "Set a different default locale first", variant: "destructive" });
      return;
    }
    setLocales((prev) => prev.filter((l) => l.code !== code));
    setDirty(true);
  }

  function setAsDefault(code: string) {
    setDefaultLocale(code);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/settings/locales", {
        default_locale: defaultLocale,
        supported_locales: locales,
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/locales"] });
      setDirty(false);
      toast({ title: "Settings saved", description: `${locales.length} locale(s) configured` });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleBrandSave(imageUrl: string) {
    setBrandSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/admin/brand-settings", {
        default_social_image: imageUrl,
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brand-settings"] });
      toast({ title: "Brand settings saved", description: "Default social image updated." });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setBrandSaving(false);
    }
  }

  async function handleTwitterSave() {
    setTwitterSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/admin/brand-settings", {
        twitter_handle: twitterHandle.trim(),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brand-settings"] });
      toast({ title: "Twitter / X handle saved" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setTwitterSaving(false);
    }
  }

  async function handleSocialLinkSave(platform: keyof typeof socialLinks) {
    setSocialSaving(platform);
    try {
      const res = await apiRequest("PUT", "/api/admin/brand-settings", {
        [platform]: socialLinks[platform].trim(),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brand-settings"] });
      toast({ title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} URL saved` });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSocialSaving(null);
    }
  }

  async function runMigration(filename: string) {
    setMigrationStates((prev) => ({
      ...prev,
      [filename]: { running: true, result: null },
    }));
    try {
      const res = await apiRequest("POST", "/api/migrations/run", { filename });
      const result = await res.json();
      setMigrationStates((prev) => ({
        ...prev,
        [filename]: { running: false, result },
      }));
    } catch (err: any) {
      setMigrationStates((prev) => ({
        ...prev,
        [filename]: { running: false, result: { success: false, output: err.message || String(err) } },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/private/diagnostics">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-settings-title">Settings</h1>
            <p className="text-sm text-muted-foreground">Site-wide configuration</p>
          </div>
        </div>

        <Tabs defaultValue="locales">
          <TabsList className="flex w-full">
            <TabsTrigger value="locales" data-testid="tab-locales">
              <IconLanguage className="h-4 w-4 mr-1.5" />
              Locales
            </TabsTrigger>
            <TabsTrigger value="migrations" data-testid="tab-migrations">
              <IconCode className="h-4 w-4 mr-1.5" />
              Migrations
            </TabsTrigger>
            <TabsTrigger value="brand" data-testid="tab-brand">
              <IconPhoto className="h-4 w-4 mr-1.5" />
              Brand
            </TabsTrigger>
            {canManageUsers && (
              <TabsTrigger value="roles" data-testid="tab-roles">
                <IconShield className="h-4 w-4 mr-1.5" />
                Roles
              </TabsTrigger>
            )}
            {canManageUsers && (
              <TabsTrigger value="users" data-testid="tab-users">
                <IconUsers className="h-4 w-4 mr-1.5" />
                Users
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="locales" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                <div className="flex items-center gap-2">
                  <IconLanguage className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Internationalization</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  data-testid="button-save-locales"
                >
                  {saving ? (
                    <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="h-4 w-4 mr-1.5" />
                  )}
                  Save
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Supported Locales</p>
                      <p className="text-xs text-muted-foreground">
                        Locales available for content and URL patterns. The default locale is used as fallback.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {locales.map((locale) => (
                        <div
                          key={locale.code}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md border"
                          data-testid={`row-locale-${locale.code}`}
                        >
                          <code className="text-sm font-mono font-medium w-8">{locale.code}</code>
                          <span className="text-sm flex-1">{locale.label}</span>
                          {locale.code === defaultLocale ? (
                            <Badge variant="secondary" className="gap-1" data-testid={`badge-default-${locale.code}`}>
                              <IconStar className="fill-current h-3 w-3" />
                              Default
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAsDefault(locale.code)}
                              title="Set as default"
                              data-testid={`button-set-default-${locale.code}`}
                            >
                              <IconStar className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLocale(locale.code)}
                            disabled={locales.length <= 1 || locale.code === defaultLocale}
                            title="Remove locale"
                            data-testid={`button-remove-locale-${locale.code}`}
                          >
                            <IconTrash className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-end gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Code</label>
                        <Input
                          placeholder="pt"
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 3))}
                          className="w-20"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocale(); } }}
                          data-testid="input-new-locale-code"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Label</label>
                        <Input
                          placeholder="Portuguese"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocale(); } }}
                          data-testid="input-new-locale-label"
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={addLocale}
                        disabled={!newCode.trim() || !newLabel.trim()}
                        data-testid="button-add-locale"
                      >
                        <IconPlus className="h-4 w-4 mr-1.5" />
                        Add
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="migrations" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-4">
                <IconCode className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Migrations</CardTitle>
              </CardHeader>
              <CardContent>
                {migrationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !migrations || migrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No migration scripts found.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      One-time data scripts. Each migration is idempotent — safe to re-run.
                    </p>
                    <div className="space-y-2">
                      {migrations.map((migration) => {
                        const state = migrationStates[migration.filename];
                        const running = state?.running ?? false;
                        const result = state?.result ?? null;
                        return (
                          <div key={migration.filename} className="space-y-2" data-testid={`row-migration-${migration.filename}`}>
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border">
                              <code className="text-xs font-mono text-muted-foreground flex-1 truncate" data-testid={`text-migration-name-${migration.filename}`}>
                                {migration.filename}
                              </code>
                              {result && (
                                result.success
                                  ? <IconCheck className="h-4 w-4 text-green-500 shrink-0" />
                                  : <IconAlertCircle className="h-4 w-4 text-destructive shrink-0" />
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="About this migration"
                                    data-testid={`button-info-migration-${migration.filename}`}
                                  >
                                    <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 text-sm" side="left" align="start">
                                  <p className="font-medium mb-1">{migration.name}</p>
                                  <p className="text-muted-foreground text-xs leading-relaxed">{migration.description}</p>
                                </PopoverContent>
                              </Popover>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => runMigration(migration.filename)}
                                disabled={running}
                                title="Run migration"
                                data-testid={`button-run-migration-${migration.filename}`}
                              >
                                {running
                                  ? <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  : <IconPlayerPlay className="h-4 w-4 text-muted-foreground" />
                                }
                              </Button>
                            </div>
                            {result && (
                              <pre
                                className={`text-xs font-mono rounded-md border px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap ${
                                  result.success
                                    ? "border-green-500/30 bg-green-500/5 text-foreground"
                                    : "border-destructive/30 bg-destructive/5 text-destructive"
                                }`}
                                data-testid={`text-migration-output-${migration.filename}`}
                              >
                                {result.output || (result.success ? "Done." : "Failed with no output.")}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-4">
                <IconPhoto className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Brand Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {brandLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Default Social Image</p>
                      <p className="text-xs text-muted-foreground">
                        Used as the fallback <code className="font-mono">og:image</code> on pages that don't have a specific social image. Recommended size: 1200×630 px.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saved to <code className="font-mono">marketing-content/schema-org.yml</code> under <code className="font-mono">website.default_social_image</code>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {brandData?.default_social_image ? (
                        <div
                          className="rounded-md border bg-muted overflow-hidden"
                          style={{ aspectRatio: "1200/630", maxHeight: "160px" }}
                          data-testid="img-brand-social-preview-container"
                        >
                          <img
                            src={brandData.default_social_image}
                            alt="Default social image preview"
                            className="object-cover w-full h-full"
                            data-testid="img-brand-social-preview"
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-md border bg-muted flex items-center justify-center text-muted-foreground"
                          style={{ aspectRatio: "1200/630", maxHeight: "160px" }}
                          data-testid="div-brand-social-placeholder"
                        >
                          <div className="text-center space-y-1">
                            <IconPhoto className="h-8 w-8 mx-auto opacity-40" />
                            <p className="text-xs">No image selected</p>
                          </div>
                        </div>
                      )}

                      {brandData?.default_social_image && (
                        <p className="text-xs text-muted-foreground font-mono truncate" data-testid="text-brand-social-url">
                          {brandData.default_social_image}
                        </p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBrandImagePickerOpen(true)}
                        disabled={brandSaving || !canEditSeo}
                        title={!canEditSeo ? "You don't have permission to edit brand settings" : undefined}
                        data-testid="button-brand-choose-image"
                      >
                        {brandSaving ? (
                          <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <IconPhoto className="h-4 w-4 mr-1.5" />
                        )}
                        Choose from gallery
                      </Button>
                    </div>

                    <div className="pt-2 border-t space-y-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Twitter / X Handle</p>
                        <p className="text-xs text-muted-foreground">
                          Saved to <code className="font-mono">marketing-content/schema-org.yml</code> under <code className="font-mono">organization.same_as</code>.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={twitterHandle}
                          onChange={(e) => setTwitterHandle(e.target.value)}
                          placeholder="@handle"
                          disabled={twitterSaving || !canEditSeo}
                          data-testid="input-brand-twitter-handle"
                          className="font-mono"
                        />
                        <Button
                          size="sm"
                          onClick={handleTwitterSave}
                          disabled={twitterSaving || !canEditSeo}
                          title={!canEditSeo ? "You don't have permission to edit brand settings" : undefined}
                          data-testid="button-brand-save-twitter"
                        >
                          {twitterSaving ? (
                            <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <IconDeviceFloppy className="h-4 w-4 mr-1.5" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>

                    <div className="pt-2 border-t space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Social Links</p>
                        <p className="text-xs text-muted-foreground">
                          Stored in <code className="font-mono">organization.same_as</code> in <code className="font-mono">schema-org.yml</code>.
                        </p>
                      </div>
                      {(
                        [
                          { key: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/school/yourorg/" },
                          { key: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/yourorg" },
                          { key: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/c/YourOrg" },
                          { key: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/yourorg/" },
                          { key: "github", label: "GitHub", placeholder: "https://github.com/YourOrg" },
                        ] as { key: keyof typeof socialLinks; label: string; placeholder: string }[]
                      ).map(({ key, label, placeholder }) => {
                        const fieldError = socialErrors[key] ?? null;
                        return (
                          <div key={key} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">{label}</label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={socialLinks[key]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSocialLinks((prev) => ({ ...prev, [key]: val }));
                                  setSocialErrors((prev) => ({ ...prev, [key]: validateSocialUrl(key, val) }));
                                }}
                                placeholder={placeholder}
                                disabled={socialSaving === key || !canEditSeo}
                                data-testid={`input-brand-${key}`}
                                className={`font-mono text-xs${fieldError ? " border-destructive focus-visible:ring-destructive" : ""}`}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSocialLinkSave(key)}
                                disabled={socialSaving === key || !canEditSeo || !!fieldError}
                                title={
                                  !canEditSeo
                                    ? "You don't have permission to edit brand settings"
                                    : fieldError
                                    ? fieldError
                                    : undefined
                                }
                                data-testid={`button-brand-save-${key}`}
                              >
                                {socialSaving === key ? (
                                  <IconLoader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <IconDeviceFloppy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            {fieldError && (
                              <p className="text-xs text-destructive" data-testid={`error-brand-${key}`}>
                                {fieldError}
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {brandData?.unknown_same_as && brandData.unknown_same_as.length > 0 && (
                        <div className="pt-2 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Other links (read-only)</p>
                          <p className="text-xs text-muted-foreground">These URLs are in <code className="font-mono">same_as</code> but don't match a known platform. Edit them directly in the YAML file.</p>
                          <div className="space-y-1">
                            {brandData.unknown_same_as.map((url) => (
                              <p key={url} className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1 truncate" data-testid="text-brand-unknown-sameas">
                                {url}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <ImagePickerDialog
              open={brandImagePickerOpen}
              onOpenChange={setBrandImagePickerOpen}
              title="Select Default Social Image"
              initialSrc={brandData?.default_social_image ?? ""}
              initialAlt="Default social image"
              onSave={async (src) => {
                await handleBrandSave(src);
              }}
            />
          </TabsContent>

          {canManageUsers && (
            <TabsContent value="roles" className="mt-4">
              <RolesTab />
            </TabsContent>
          )}

          {canManageUsers && (
            <TabsContent value="users" className="mt-4">
              <UsersTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
