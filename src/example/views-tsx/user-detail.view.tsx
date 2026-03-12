export interface UserDetailPageViewProps {
  userName: string;
  userEmail: string;
  userStatus: string;
  userStatusClass: string;
  userId: number;
}

export default function UserDetailPageView(props: UserDetailPageViewProps) {
  return (
    <main>
      <nav>
        <a href="/">← All users</a>
      </nav>
      <h1>{props.userName}</h1>
      <dl>
        <dt>Email</dt>
        <dd>{props.userEmail}</dd>
        <dt>Status</dt>
        <dd>
          <span className={props.userStatusClass}>{props.userStatus}</span>
        </dd>
        <dt>ID</dt>
        <dd>{props.userId}</dd>
      </dl>
    </main>
  );
}
