export interface UserEditPageViewProps {
  userId: number;
  userName: string;
  userEmail: string;
  statusOptionsHtml: string;
}

export default function UserEditPageView(props: UserEditPageViewProps) {
  return (
    <main>
      <nav>
        <a href="/">← All users</a>
      </nav>
      <h2>Edit User</h2>
      <form method="POST" action={`/api/users/${props.userId}`} novalidate>
        <label>
          Name
          <input name="name" value={props.userName} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={props.userEmail} required />
        </label>
        <label>
          Status
          <select name="status">
            <hx-slot value={props.statusOptionsHtml} />
          </select>
        </label>
        <button type="submit">Save Changes</button>
      </form>
    </main>
  );
}
