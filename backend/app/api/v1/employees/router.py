from fastapi import APIRouter

from app.api.v1.schemas import PaginatedResponse
from . import controller
from .schema import AttendanceResponse, DepartmentResponse, EmployeeResponse, RegularizationResponse

router = APIRouter()

router.get("/departments", response_model=list[DepartmentResponse])(controller.list_departments)
router.post("/departments", response_model=DepartmentResponse)(controller.create_department)
router.patch("/departments/{dept_id}", response_model=DepartmentResponse)(controller.update_department)
router.get("/regularizations", response_model=list[RegularizationResponse])(controller.list_regularizations)
router.patch("/regularizations/{request_id}", response_model=RegularizationResponse)(controller.review_regularization)
router.get("/", response_model=PaginatedResponse[EmployeeResponse])(controller.list_employees)
router.post("/", response_model=EmployeeResponse)(controller.create_employee)
router.get("/{employee_id}", response_model=EmployeeResponse)(controller.get_employee)
router.patch("/{employee_id}", response_model=EmployeeResponse)(controller.update_employee)
router.post("/{employee_id}/check-in", response_model=AttendanceResponse)(controller.check_in)
router.post("/{employee_id}/check-out", response_model=AttendanceResponse)(controller.check_out)
router.get("/{employee_id}/attendance", response_model=list[AttendanceResponse])(controller.get_attendance)
router.post("/{employee_id}/regularizations", response_model=RegularizationResponse)(controller.create_regularization)
