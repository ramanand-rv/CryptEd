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
        const myCourses = res.data.filter(
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-800">Educator Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">My Courses</h2>
          <Link
            to="/courses/new"
            className="bg-blue-600 text-white px-6 py-3 rounded-md shadow-md hover:bg-blue-700 transition-transform transform hover:scale-105"
          >
            + Create New Course
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600"></div>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-lg shadow-md">
            <h3 className="text-2xl font-semibold mb-4">No courses yet!</h3>
            <p className="text-gray-500 mb-6">Click "Create New Course" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
              <div key={course._id} className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{course.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 h-20 overflow-hidden">
                    {course.description.substring(0, 120)}...
                  </p>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-lg font-semibold text-blue-600">{course.price / 1e9} SOL</p>
                    <p className="text-xs text-gray-500">
                      {new Date(course.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    to={`/courses/${course._id}`}
                    className="w-full text-center bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Edit Course →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
