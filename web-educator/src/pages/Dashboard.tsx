import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

interface Course {
  _id: string;
  title: string;
  description: string;
  price: number;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/courses", {
          headers: { "x-auth-token": token },
        });
        // Filter only courses created by this educator (backend may return all, but we can filter client-side)
        // Better: backend should accept ?educatorId but for simplicity, we'll filter here.
        const myCourses = res.data.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (c: any) => c.educatorId._id === user?.id,
        );
        setCourses(myCourses);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [token, user]);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Educator Dashboard</h1>
        <div className="flex items-center gap-4">
          <span>Welcome, {user?.name}</span>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">My Courses</h2>
          <Link
            to="/courses/new"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Create New Course
          </Link>
        </div>

        {loading ? (
          <p>Loading courses...</p>
        ) : courses.length === 0 ? (
          <p>You haven't created any courses yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div key={course._id} className="bg-white rounded shadow p-4">
                <h3 className="text-lg font-bold mb-2">{course.title}</h3>
                <p className="text-gray-600 text-sm mb-2">
                  {course.description.substring(0, 100)}...
                </p>
                <p className="text-sm mb-1">Price: {course.price / 1e9} SOL</p>
                <p className="text-xs text-gray-400">
                  Created: {new Date(course.createdAt).toLocaleDateString()}
                </p>
                <Link
                  to={`/courses/${course._id}`}
                  className="text-blue-600 text-sm mt-2 inline-block"
                >
                  Edit Course →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
