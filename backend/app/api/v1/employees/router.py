from fastapi import APIRouter

from . import controller
from .schema import AttendanceResponse, DepartmentResponse, EmployeeResponse

router = APIRouter()

router.get("/departments", response_model=list[DepartmentResponse])(controller.list_departments)
router.post("/departments", response_model=DepartmentResponse)(controller.create_department)
router.get("/", response_model=list[EmployeeResponse])(controller.list_employees)
router.post("/", response_model=EmployeeResponse)(controller.create_employee)
router.get("/{employee_id}", response_model=EmployeeResponse)(controller.get_employee)
router.patch("/{employee_id}", response_model=EmployeeResponse)(controller.update_employee)
router.post("/{employee_id}/check-in", response_model=AttendanceResponse)(controller.check_in)
router.post("/{employee_id}/check-out", response_model=AttendanceResponse)(controller.check_out)
router.get("/{employee_id}/attendance", response_model=list[AttendanceResponse])(controller.get_attendance)
